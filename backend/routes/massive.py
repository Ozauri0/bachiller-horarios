import threading
import json
import math
from datetime import datetime
from io import BytesIO
import pandas as pd
from flask import Blueprint, jsonify, request, current_app, send_file
from backend.services.massive import load_alumnos_dataframe, process_massive, INF_CAP, load_capacity_map
from backend.utils.constants import DATA_DIR

mass_bp = Blueprint('mass', __name__)

# Estado simple en memoria para seguimiento de progreso
MASS_STATE = {
    'running': False,
    'total': 0,
    'current': 0,
    'current_name': '',
    'current_registro': '',
    'results': None,
    'summary': None,
    'error': None,
    'phase': '',
    'capacity_report': None,
    'capacity_stats': None
}

EXPORT_COLUMNS = [
    'RUT',
    'DV',
    'REGISTRO',
    'NOMBRE',
    'APELLIDO PATERNO',
    'APELLIDO MATERNO',
    'CODIGO ASIGNATURA',
    'NOMBRE ASIGNATURA',
    'SECCION',
    'GRUPO',
    'SEMESTRE',
    'PLAN'
]


def _sanitize_for_json(value):
    if isinstance(value, dict):
        return {k: _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_json(v) for v in value]
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
    if isinstance(value, (int, bool, type(None), str)):
        return value
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


def _apply_sections_capacity(sections, caps, delta):
    for sec in sections or []:
        try:
            key = (str(sec.get('course')), int(sec.get('section')))
        except Exception:
            continue
        caps[key] = caps.get(key, INF_CAP) + delta


def _build_capacity_stats(capacity_report):
    if not capacity_report:
        return {'over_capacity': [], 'most_empty': []}
    over_capacity = [c for c in capacity_report if c.get('over_capacity') or c.get('remaining', 0) < 0]
    most_empty = sorted(capacity_report, key=lambda x: x.get('remaining', 0), reverse=True)
    return {
        'over_capacity': over_capacity,
        'most_empty': most_empty
    }


def _results_to_rows(results):
    rows = []
    if not results:
        return rows

    for r in results:
        if r.get('status') == 'sin_horario':
            continue

        courses = r.get('courses_detail') or r.get('sections') or []
        for course in courses:
            code = course.get('course') or course.get('code') or ''
            rows.append({
                'RUT': r.get('rut_num', ''),
                'DV': r.get('dv', ''),
                'REGISTRO': r.get('registro', ''),
                'NOMBRE': r.get('nombre_pila', ''),
                'APELLIDO PATERNO': r.get('apellido_paterno', ''),
                'APELLIDO MATERNO': r.get('apellido_materno', ''),
                'CODIGO ASIGNATURA': code,
                'NOMBRE ASIGNATURA': course.get('name', ''),
                'SECCION': course.get('section', ''),
                'GRUPO': course.get('group', ''),
                'SEMESTRE': course.get('semestre', ''),
                'PLAN': course.get('plan', '')
            })

    return rows


def _is_schedule_valid_for_summary(entry):
    if not entry:
        return False
    return entry.get('status') == 'con_horario'


def _build_massive_summary(results):
    total = len(results)
    valid = sum(1 for r in results if _is_schedule_valid_for_summary(r))
    # Solo contar topón válido si el horario es realmente válido (sin conflictos adicionales)
    valid_topon = sum(1 for r in results if r.get('has_valid_topones') and r.get('status') == 'con_horario' and not r.get('has_conflicts'))
    return {
        'total_alumnos': total,
        'con_horario': valid,
        'sin_horario': total - valid,
        'con_topon_valido': valid_topon
    }


def _run_rebalance_job(target_registros, prev_results, base_df):
    try:
        alumnos_df = load_alumnos_dataframe()
        alumnos_df['REGISTRO'] = alumnos_df['REGISTRO'].astype(str)
        subset_df = alumnos_df[alumnos_df['REGISTRO'].isin(target_registros)]

        if subset_df.empty:
            MASS_STATE.update({'running': False, 'phase': 'error', 'error': 'No se encontraron alumnos en el Excel actual', 'rebalanced_count': 0})
            return

        capacities = load_capacity_map()
        remaining_caps = capacities.copy()

        # Reservar cupos de alumnos que NO se van a recalcular
        for r in prev_results:
            reg = str(r.get('registro', '')).strip()
            if reg in target_registros:
                continue
            _apply_sections_capacity(r.get('sections'), remaining_caps, -1)

        # Ejecutar solo con el subconjunto elegible, respetando cupos actuales
        results_subset, capacity_report = process_massive(
            base_df,
            subset_df,
            progress_cb=_progress_cb,
            capacities_override=capacities,
            remaining_caps_override=remaining_caps
        )

        # Combinar con el resto de alumnos
        combined = []
        updated_by_reg = {str(r.get('registro', '')).strip(): r for r in results_subset}
        rebalanced_count = len(updated_by_reg)
        for r in prev_results:
            reg = str(r.get('registro', '')).strip()
            if reg in updated_by_reg:
                combined.append(updated_by_reg[reg])
            else:
                combined.append(r)

        total = len(combined)
        capacity_stats = _build_capacity_stats(capacity_report)
        summary = _build_massive_summary(combined)

        combined_clean = _sanitize_for_json(combined)
        capacity_report_clean = _sanitize_for_json(capacity_report)
        capacity_stats_clean = _sanitize_for_json(capacity_stats)
        summary_clean = _sanitize_for_json(summary)

        payload = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'summary': summary_clean,
            'capacity_report': capacity_report_clean,
            'capacity_stats': capacity_stats_clean
        }
        _save_capacity_report(payload)

        MASS_STATE.update({
            'running': False,
            'results': combined_clean,
            'summary': summary_clean,
            'error': None,
            'phase': 'completado',
            'capacity_report': capacity_report_clean,
            'capacity_stats': capacity_stats_clean,
            'current': total,
            'total': total,
            'current_name': '',
            'current_registro': '',
            'rebalanced_count': rebalanced_count,
        })
    except Exception as e:
        print(f"ERROR en rebalance masivo async: {e}")
        import traceback
        traceback.print_exc()
        MASS_STATE.update({
            'running': False,
            'phase': 'error',
            'error': str(e),
            'capacity_report': None,
            'capacity_stats': None,
            'rebalanced_count': 0
        })


def _save_capacity_report(payload):
    try:
        payload = _sanitize_for_json(payload)
        path = DATA_DIR / 'massive_report.json'
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2, allow_nan=False)
    except Exception as exc:
        print(f"WARN: no se pudo guardar massive_report.json: {exc}")


@mass_bp.route('/mass/generate', methods=['POST'])
def api_mass_generate():
    try:
        upload = request.files.get('file') if 'file' in request.files else None
        if upload and upload.filename:
            save_path = DATA_DIR / 'alumnos.xlsx'
            upload.save(save_path)

        alumnos_df = load_alumnos_dataframe(upload)
        base_df = current_app.config['DATAFRAME']

        results, capacity_report = process_massive(base_df, alumnos_df)
        summary = _build_massive_summary(results)
        capacity_stats = _build_capacity_stats(capacity_report)

        results_clean = _sanitize_for_json(results)
        capacity_report_clean = _sanitize_for_json(capacity_report)
        capacity_stats_clean = _sanitize_for_json(capacity_stats)
        summary_clean = _sanitize_for_json(summary)

        payload = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'summary': summary_clean,
            'capacity_report': capacity_report_clean,
            'capacity_stats': capacity_stats_clean
        }
        _save_capacity_report(payload)

        return jsonify({
            'success': True,
            'summary': summary_clean,
            'results': results_clean,
            'capacity_report': capacity_report_clean,
            'capacity_stats': capacity_stats_clean
        })
    except Exception as e:
        print(f"ERROR en carga masiva: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


def _progress_cb(idx, total, name, registro, phase='generando'):
    # Clamp to avoid showing "total+1" when we emit the final adjustment phase
    MASS_STATE['current'] = min(idx + 1, total)
    MASS_STATE['total'] = total
    MASS_STATE['current_name'] = name
    MASS_STATE['current_registro'] = registro
    MASS_STATE['phase'] = phase


def _run_massive_job(alumnos_df, base_df):
    try:
        MASS_STATE.update({
            'running': True,
            'results': None,
            'summary': None,
            'error': None,
            'current': 0,
            'total': 0,
            'current_name': '',
            'current_registro': '',
            'phase': 'generando',
            'rebalanced_count': 0
        })

        results, capacity_report = process_massive(base_df, alumnos_df, progress_cb=_progress_cb)
        summary = _build_massive_summary(results)
        capacity_stats = _build_capacity_stats(capacity_report)

        results_clean = _sanitize_for_json(results)
        capacity_report_clean = _sanitize_for_json(capacity_report)
        capacity_stats_clean = _sanitize_for_json(capacity_stats)
        summary_clean = _sanitize_for_json(summary)

        payload = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'summary': summary_clean,
            'capacity_report': capacity_report_clean,
            'capacity_stats': capacity_stats_clean
        }
        _save_capacity_report(payload)

        MASS_STATE.update({
            'running': False,
            'results': results_clean,
            'summary': summary_clean,
            'error': None,
            'phase': 'completado',
            'capacity_report': capacity_report_clean,
            'capacity_stats': capacity_stats_clean,
            'rebalanced_count': 0
        })
    except Exception as e:
        MASS_STATE.update({
            'running': False,
            'results': None,
            'summary': None,
            'error': str(e),
            'phase': 'error',
            'capacity_report': None,
            'capacity_stats': None,
            'rebalanced_count': 0
        })


@mass_bp.route('/mass/generate_async', methods=['POST'])
def api_mass_generate_async():
    try:
        if MASS_STATE.get('running'):
            return jsonify({'success': False, 'error': 'Ya hay un proceso en ejecución'}), 409

        upload = request.files.get('file') if 'file' in request.files else None
        if upload and upload.filename:
            save_path = DATA_DIR / 'alumnos.xlsx'
            upload.save(save_path)

        alumnos_df = load_alumnos_dataframe(upload)
        base_df = current_app.config['DATAFRAME']

        # Preparar estado inicial
        total = len(alumnos_df.groupby('REGISTRO'))
        MASS_STATE.update({
            'running': True,
            'results': None,
            'summary': None,
            'error': None,
            'current': 0,
            'total': total,
            'current_name': '',
            'current_registro': '',
            'capacity_report': None,
            'capacity_stats': None,
            'rebalanced_count': 0
        })

        thread = threading.Thread(target=_run_massive_job, args=(alumnos_df, base_df), daemon=True)
        thread.start()

        return jsonify({'success': True, 'total': total})
    except Exception as e:
        print(f"ERROR en carga masiva async: {str(e)}")
        import traceback
        traceback.print_exc()
        MASS_STATE.update({
            'running': False,
            'error': str(e),
            'rebalanced_count': 0
        })
        return jsonify({'success': False, 'error': str(e)}), 500


@mass_bp.route('/mass/progress', methods=['GET'])
def api_mass_progress():
    state = MASS_STATE.copy()
    state['remaining'] = max(state.get('total', 0) - state.get('current', 0), 0)
    state['done'] = not state.get('running') and state.get('results') is not None
    clean_state = _sanitize_for_json(state)
    return jsonify({'success': True, 'state': clean_state})


@mass_bp.route('/mass/export', methods=['GET'])
def api_mass_export():
    try:
        results = MASS_STATE.get('results') or []
        if not results:
            return jsonify({'success': False, 'error': 'No hay resultados para exportar'}), 404

        rows = _results_to_rows(results)
        if not rows:
            return jsonify({'success': False, 'error': 'No hay horarios generados para exportar'}), 400

        df = pd.DataFrame(rows, columns=EXPORT_COLUMNS)
        output = BytesIO()
        df.to_excel(output, index=False)
        output.seek(0)

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='carga_masiva.xlsx'
        )
    except Exception as e:
        print(f"ERROR exportando XLSX masivo: {e}")
        return jsonify({'success': False, 'error': 'Error exportando resultados'}), 500


@mass_bp.route('/mass/rebalance', methods=['POST'])
def api_mass_rebalance():
    try:
        if MASS_STATE.get('running'):
            return jsonify({'success': False, 'error': 'Ya hay un proceso en ejecución'}), 409

        prev_results = MASS_STATE.get('results') or []
        prev_capacity_report = MASS_STATE.get('capacity_report') or []

        if not prev_results:
            return jsonify({'success': False, 'error': 'No hay ejecución previa de carga masiva'}), 400

        overfull_keys = set()
        for c in prev_capacity_report:
            try:
                key = (str(c.get('course')), int(c.get('section')))
            except Exception:
                continue
            if c.get('over_capacity') or c.get('remaining', 0) < 0:
                overfull_keys.add(key)

        if not overfull_keys:
            return jsonify({'success': False, 'error': 'No hay secciones con sobrecupo'}), 400

        target_registros = set()
        for r in prev_results:
            reg = str(r.get('registro', '')).strip()
            if not reg:
                continue

            sections = r.get('sections') or []
            for s in sections:
                key = (str(s.get('course')), int(s.get('section')) if s.get('section') is not None else None)
                if key in overfull_keys:
                    target_registros.add(reg)
                    break

        target_count = len(target_registros)
        if not target_count:
            return jsonify({'success': False, 'error': 'No hay alumnos para recalcular'}), 400

        MASS_STATE.update({
            'running': True,
            'phase': 'recalculando',
            'current': 0,
            'total': target_count,
            'current_name': '',
            'current_registro': '',
            'error': None,
            'capacity_report': None,
            'capacity_stats': None,
            'summary': None,
            'results': None,
            'rebalanced_count': 0
        })

        base_df = current_app.config['DATAFRAME']
        thread = threading.Thread(target=_run_rebalance_job, args=(target_registros, prev_results, base_df), daemon=True)
        thread.start()

        return jsonify({
            'success': True,
            'started': True,
            'total': target_count
        })
    except Exception as e:
        print(f"ERROR en rebalance masivo: {e}")
        import traceback
        traceback.print_exc()
        MASS_STATE.update({
            'running': False,
            'phase': 'error',
            'error': str(e),
            'rebalanced_count': 0
        })
        return jsonify({'success': False, 'error': str(e)}), 500


@mass_bp.route('/mass/report', methods=['GET'])
def api_mass_report():
    try:
        path = DATA_DIR / 'massive_report.json'
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify({'success': True, 'report': data})
        # Si no hay archivo, devolver estado en memoria si existe
        if MASS_STATE.get('capacity_report'):
            return jsonify({
                'success': True,
                'report': {
                    'timestamp': datetime.utcnow().isoformat() + 'Z',
                    'summary': MASS_STATE.get('summary'),
                    'capacity_report': MASS_STATE.get('capacity_report'),
                    'capacity_stats': MASS_STATE.get('capacity_stats')
                }
            })
        return jsonify({'success': False, 'error': 'Sin reportes previos'}), 404
    except Exception as e:
        print(f"ERROR leyendo massive_report.json: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mass_bp.route('/mass/student/save', methods=['POST'])
def api_mass_student_save():
    try:
        data = request.get_json(silent=True) or {}
        registro = str(data.get('registro', '')).strip()
        if not registro:
            return jsonify({'success': False, 'error': 'Falta registro'}), 400

        schedule = data.get('schedule') or {}
        sections = schedule.get('sections') or []
        blocks = schedule.get('blocks') or []
        courses = data.get('courses') or []
        if not sections:
            return jsonify({'success': False, 'error': 'Faltan secciones para guardar'}), 400

        alumnos_df = load_alumnos_dataframe()
        alumnos_df['REGISTRO'] = alumnos_df['REGISTRO'].astype(str)

        existing_rows = alumnos_df[alumnos_df['REGISTRO'] == registro]
        if not existing_rows.empty:
            base = existing_rows.iloc[0].to_dict()
        else:
            # Fallback vacío
            base = {
                'RUT': '',
                'DV': '',
                'REGISTRO': registro,
                'NOMBRE': '',
                'APELLIDO PATERNO': '',
                'APELLIDO MATERNO': ''
            }

        # Usar rut/nombre si llegan en payload para completar faltantes
        rut_payload = (data.get('rut') or '').strip()
        if rut_payload and '-' in rut_payload:
            rut_num, dv_val = rut_payload.split('-', 1)
            base['RUT'] = rut_num.strip()
            base['DV'] = dv_val.strip()
        elif rut_payload:
            base['RUT'] = rut_payload

        # No sobrescribir el nombre si ya existe: el payload suele traer nombre completo (con apellidos)
        # y generaría duplicaciones al volver a concatenar nombre + apellidos en el reporte.
        nombre_payload = (data.get('nombre') or '').strip()
        if nombre_payload and not str(base.get('NOMBRE', '')).strip():
            base['NOMBRE'] = nombre_payload

        # Construir filas nuevas para este registro
        new_rows = []
        for sec in sections:
            row = base.copy()
            row['REGISTRO'] = registro
            row['CODIGO ASIGNATURA'] = sec.get('course') or sec.get('code') or ''
            row['NOMBRE ASIGNATURA'] = sec.get('name', '')
            row['SECCION'] = sec.get('section')
            row['GRUPO'] = sec.get('group')
            row['SEMESTRE'] = sec.get('semestre')
            row['PLAN'] = sec.get('plan')
            new_rows.append(row)

        # Reemplazar filas previas del registro por las nuevas
        remaining_df = alumnos_df[alumnos_df['REGISTRO'] != registro]
        updated_df = pd.concat([remaining_df, pd.DataFrame(new_rows)], ignore_index=True)

        # Conservar orden de columnas si es posible
        try:
            updated_df = updated_df[alumnos_df.columns]
        except Exception:
            pass

        save_path = DATA_DIR / 'alumnos.xlsx'
        updated_df.to_excel(save_path, index=False)

        # Actualizar el estado en memoria para export/xlsx
        results = MASS_STATE.get('results') or []
        updated_results = []
        found = False
        status = 'con_horario'
        if schedule.get('has_conflicts') or schedule.get('conflict_types'):
            status = 'no_valido'
        entry = {
            'registro': registro,
            'rut': data.get('rut') or base.get('RUT') or '',
            'nombre': data.get('nombre') or base.get('NOMBRE') or '',
            'cursos': courses,
            'status': status,
            'message': 'Horario guardado manualmente',
            'sections': schedule.get('sections', []),
            'blocks': blocks,
            'courses_detail': schedule.get('sections', []),
            'has_conflicts': schedule.get('has_conflicts', False),
            'conflict_types': schedule.get('conflict_types', []),
            'valid_topones': schedule.get('valid_topones', []),
            'valid_topon_types': schedule.get('valid_topon_types', []),
            'has_valid_topones': schedule.get('has_valid_topones', False),
            'conflicts': schedule.get('conflicts', [])
        }

        for r in results:
            if str(r.get('registro', '')).strip() == registro:
                updated_results.append(entry)
                found = True
            else:
                updated_results.append(r)
        if not found:
            updated_results.append(entry)

        MASS_STATE['results'] = updated_results
        MASS_STATE['summary'] = _build_massive_summary(updated_results)

        return jsonify({'success': True, 'result': entry})
    except Exception as e:
        print(f"ERROR guardando alumno masivo: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
