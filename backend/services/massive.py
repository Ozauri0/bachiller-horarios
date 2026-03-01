import pandas as pd
from backend.services.schedules import generate_schedules
from backend.services.config_loader import load_saved_config
from backend.utils.constants import DATA_DIR


def load_capacity_map():
    path = DATA_DIR / 'cursos_disponibles.xlsx'
    try:
        df = pd.read_excel(path, header=1)
    except Exception:
        return {}

    caps = {}
    for _, row in df.iterrows():
        code = str(row.get('COD CURSO', '')).strip()
        if not code:
            continue
        section = row.get('SECCION')
        try:
            section = int(section)
        except Exception:
            section = None
        cupos = row.get('CUPO ASIGNADO')
        try:
            cupos = int(cupos)
        except Exception:
            cupos = None
        if section is None or cupos is None:
            continue
        key = (code, section)
        caps[key] = caps.get(key, 0) + cupos
    return caps


INF_CAP = 10 ** 9


def load_alumnos_dataframe(uploaded_file=None):
    if uploaded_file is not None:
        df = pd.read_excel(uploaded_file)
    else:
        df = pd.read_excel(DATA_DIR / 'alumnos.xlsx')
    return df


def pick_best_schedule(schedules):
    for s in schedules:
        if not s.get('has_conflicts') and not s.get('has_valid_topones'):
            return s, False
    for s in schedules:
        if not s.get('has_conflicts'):
            return s, True
    if schedules:
        return schedules[0], None
    return None, None


def schedule_capacity_ok(schedule, remaining_caps):
    for sec in schedule.get('sections', []):
        try:
            key = (str(sec['course']), int(sec['section']))
        except Exception:
            continue
        if remaining_caps.get(key, INF_CAP) <= 0:
            return False
    return True


def apply_capacity(schedule, remaining_caps, delta):
    for sec in schedule.get('sections', []):
        try:
            key = (str(sec['course']), int(sec['section']))
        except Exception:
            continue
        remaining_caps[key] = remaining_caps.get(key, INF_CAP) + delta


def build_student_df(base_df, course_codes):
    filtered = base_df[base_df['asig_codigo'].isin(course_codes)]
    missing = [code for code in course_codes if code not in filtered['asig_codigo'].unique()]
    if missing:
        return None, missing
    return filtered.reset_index(drop=True), []


def collect_course_meta(group):
    meta = {}
    for _, row in group.iterrows():
        code = str(row['CODIGO ASIGNATURA']).strip()
        if code not in meta:
            meta[code] = {
                'nombre': str(row.get('NOMBRE ASIGNATURA', '')).strip(),
                'semestre': row.get('SEMESTRE'),
                'plan': row.get('PLAN')
            }
    return meta


def _build_partial_summary(sin_results, student_entries):
    total = len(sin_results) + len(student_entries)
    con_horario = sum(1 for r in student_entries if r.get('status') == 'con_horario')
    con_topon_valido = sum(
        1 for r in student_entries
        if r.get('status') == 'con_horario' and not r.get('has_conflicts') and r.get('has_valid_topones')
    )
    return {
        'total_alumnos': total,
        'con_horario': con_horario,
        'sin_horario': total - con_horario,
        'con_topon_valido': con_topon_valido
    }


def _emit_progress(progress_cb, idx, total, name, registro, phase, sin_results, student_entries):
    if not progress_cb:
        return
    summary = _build_partial_summary(sin_results, student_entries)
    progress_cb(idx, total, name, registro, phase=phase, summary=summary)


def process_massive(base_df, alumnos_df, progress_cb=None, capacities_override=None, remaining_caps_override=None):
    group_configs, valid_topones = load_saved_config()
    capacities = capacities_override or load_capacity_map()
    remaining_caps = remaining_caps_override.copy() if remaining_caps_override is not None else capacities.copy()

    # Cache schedules per unique course set to avoid recomputing the full combinatorial search for students
    schedule_cache = {}
    # Cache filtered dataframes per unique course set to skip repeated pandas filtering
    student_df_cache = {}
    # Cache curso metadata (nombre/semestre/plan) per unique course set to avoid recomputing per alumno
    course_meta_cache = {}

    sin_horario_results = []
    grouped = alumnos_df.groupby('REGISTRO')
    total = len(grouped)

    student_entries = []

    for idx, (registro, group) in enumerate(grouped):
        registro_val = str(registro)
        rut_num = str(group['RUT'].iloc[0]).strip() if 'RUT' in group else ''
        dv_val = str(group['DV'].iloc[0]).strip() if 'DV' in group else ''
        rut = f"{rut_num}-{dv_val}" if rut_num else ''
        nombre = str(group['NOMBRE'].iloc[0]).strip() if 'NOMBRE' in group else ''
        ap_pat = str(group['APELLIDO PATERNO'].iloc[0]).strip() if 'APELLIDO PATERNO' in group else ''
        ap_mat = str(group['APELLIDO MATERNO'].iloc[0]).strip() if 'APELLIDO MATERNO' in group else ''
        nombre_completo = ' '.join(x for x in [nombre, ap_pat, ap_mat] if x).strip()

        course_codes = []
        for _, row in group.iterrows():
            code = str(row['CODIGO ASIGNATURA']).strip()
            if code and code not in course_codes:
                course_codes.append(code)

        course_codes_key = tuple(sorted(course_codes))

        if course_codes_key in course_meta_cache:
            course_meta = course_meta_cache[course_codes_key]
        else:
            course_meta = collect_course_meta(group)
            course_meta_cache[course_codes_key] = course_meta

        # Construir df solo por cursos (ignorando sección/grupo de entrada)
        if course_codes_key in student_df_cache:
            student_df, missing = student_df_cache[course_codes_key]
        else:
            student_df, missing = build_student_df(base_df, course_codes)
            student_df_cache[course_codes_key] = (student_df, missing)
        if missing:
            sin_horario_results.append({
                'registro': registro_val,
                'rut': rut,
                'rut_num': rut_num,
                'dv': dv_val,
                'nombre': nombre_completo,
                'nombre_pila': nombre,
                'apellido_paterno': ap_pat,
                'apellido_materno': ap_mat,
                'cursos': course_codes,
                'status': 'sin_horario',
                'message': 'Faltan bloques en consolidado: ' + ', '.join(missing),
                'sections': []
            })
            _emit_progress(progress_cb, idx, total, nombre_completo or registro_val, registro_val, 'generando', sin_horario_results, student_entries)
            continue

        selected_courses = course_codes

        if course_codes_key in schedule_cache:
            schedules, _stats = schedule_cache[course_codes_key]
        else:
            schedules, _stats = generate_schedules(
                student_df,
                selected_courses,
                group_configs=group_configs,
                valid_topones=valid_topones,
                include_conflicts=True,
            )
            schedule_cache[course_codes_key] = (schedules, _stats)

        # Considerar más combinaciones para mejorar chances de encontrar horarios válidos
        candidate_schedules = schedules[:100] if schedules else []

        chosen = None
        used_topon = None

        # Priorizar horarios SIN conflictos que tengan cupo
        for sched in candidate_schedules:
            if not sched.get('has_conflicts') and schedule_capacity_ok(sched, remaining_caps):
                chosen = sched
                used_topon = sched.get('has_valid_topones')
                break

        if chosen is None:
            # Elegir mejor opción disponible, aunque tenga conflictos o esté sobre cupo
            chosen, used_topon = pick_best_schedule(schedules)
        if not chosen and schedules:
            chosen = schedules[0]
            used_topon = chosen.get('has_valid_topones')
        if not chosen:
            sin_horario_results.append({
                'registro': registro_val,
                'rut': rut,
                'rut_num': rut_num,
                'dv': dv_val,
                'nombre': nombre_completo,
                'nombre_pila': nombre,
                'apellido_paterno': ap_pat,
                'apellido_materno': ap_mat,
                'cursos': selected_courses,
                'status': 'sin_horario',
                'message': 'No se encontró horario válido',
                'sections': [],
                'courses_detail': [],
                'blocks': [],
                'has_conflicts': True,
                'conflict_types': [],
                'valid_topones': [],
                'valid_topon_types': []
            })
            _emit_progress(progress_cb, idx, total, nombre_completo or registro_val, registro_val, 'generando', sin_horario_results, student_entries)
            continue

        courses_detail = []
        for sec in chosen.get('sections', []):
            meta = course_meta.get(sec['course'], {})
            courses_detail.append({
                'code': sec.get('course'),
                'name': meta.get('nombre', ''),
                'section': sec.get('section'),
                'group': sec.get('group'),
                'semestre': meta.get('semestre'),
                'plan': meta.get('plan')
            })

        status = 'con_horario'
        message = 'Horario asignado'
        if chosen.get('has_conflicts'):
            status = 'no_valido'
            message = 'Horario generado con conflictos para revisión'
        elif used_topon:
            message = 'Horario asignado con topones válidos'

        over_capacity = not schedule_capacity_ok(chosen, remaining_caps)

        if over_capacity:
            message += ' (sobre cupo)'

        apply_capacity(chosen, remaining_caps, -1)

        student_entry = {
            'registro': registro_val,
            'rut': rut,
            'rut_num': rut_num,
            'dv': dv_val,
            'nombre': nombre_completo,
            'nombre_pila': nombre,
            'apellido_paterno': ap_pat,
            'apellido_materno': ap_mat,
            'cursos': selected_courses,
            'status': status,
            'message': message,
            'sections': chosen.get('sections', []),
            'blocks': chosen.get('blocks', []),
            'courses_detail': courses_detail,
            'has_conflicts': chosen.get('has_conflicts', False),
            'conflict_types': chosen.get('conflict_types', []),
            'valid_topones': chosen.get('valid_topones', []),
            'valid_topon_types': chosen.get('valid_topon_types', []),
            'has_valid_topones': used_topon,
            'conflicts': chosen.get('conflicts', []),
            'over_capacity': over_capacity,
            'candidates': candidate_schedules
        }

        student_entries.append(student_entry)
        _emit_progress(progress_cb, idx, total, nombre_completo or registro_val, registro_val, 'generando', sin_horario_results, student_entries)

    # Ajuste por sobrecupo
    _emit_progress(progress_cb, total, total, 'Ajustando cupos', '', 'ajustando', sin_horario_results, student_entries)

    overfull_keys = {k: v for k, v in remaining_caps.items() if v < 0}
    overfull_sections = {k for k, v in remaining_caps.items() if v < 0}
    if overfull_keys:
        for entry in student_entries:
            old_sched = {
                'sections': entry['sections'],
                'blocks': entry['blocks'],
                'has_conflicts': entry['has_conflicts'],
                'valid_topones': entry.get('valid_topones', []),
                'valid_topon_types': entry.get('valid_topon_types', []),
                'has_valid_topones': entry.get('has_valid_topones', False),
                'conflicts': entry.get('conflicts', [])
            }

            uses_overfull = False
            for sec in old_sched['sections']:
                key = (str(sec.get('course')), int(sec.get('section')))
                if remaining_caps.get(key, INF_CAP) < 0:
                    uses_overfull = True
                    break

            if not uses_overfull:
                continue

            # Liberar cupos actuales
            apply_capacity(old_sched, remaining_caps, 1)

            swapped = False
            for cand in entry.get('candidates', []):
                if cand.get('sections', []) == old_sched.get('sections', []):
                    continue
                cand_sections = cand.get('sections', [])
                # No mover si sigue usando alguna sección con sobrecupo
                skip_for_overfull = False
                for sec in cand_sections:
                    try:
                        key = (str(sec.get('course')), int(sec.get('section')))
                    except Exception:
                        continue
                    if key in overfull_sections:
                        skip_for_overfull = True
                        break
                if skip_for_overfull:
                    continue

                # Solo aceptar horarios válidos (sin conflictos) y con topones válidos si aplica
                if cand.get('has_conflicts'):
                    continue
                if cand.get('valid_topones') and not cand.get('has_valid_topones'):
                    continue
                if not schedule_capacity_ok(cand, remaining_caps):
                    continue

                apply_capacity(cand, remaining_caps, -1)
                entry['sections'] = cand.get('sections', [])
                entry['blocks'] = cand.get('blocks', [])
                entry['has_conflicts'] = cand.get('has_conflicts', False)
                entry['conflicts'] = cand.get('conflicts', [])
                entry['valid_topones'] = cand.get('valid_topones', [])
                entry['valid_topon_types'] = cand.get('valid_topon_types', [])
                entry['has_valid_topones'] = cand.get('has_valid_topones', False)

                if entry['has_conflicts']:
                    entry['status'] = 'no_valido'
                    entry['message'] = 'Horario reajustado con conflictos por cupos llenos'
                else:
                    entry['status'] = 'con_horario'
                    entry['message'] = 'Horario reajustado por cupos'

                swapped = True
                break

            if not swapped:
                # Reasignar al original (aunque sobrecupo)
                apply_capacity(old_sched, remaining_caps, -1)

    _emit_progress(progress_cb, total, total, 'Ajuste completado', '', 'ajustando', sin_horario_results, student_entries)

    # Limpiar y retornar resultados finales
    results = list(sin_horario_results)
    for entry in student_entries:
        entry.pop('candidates', None)
        results.append(entry)

    # Construir reporte de capacidad por curso/sección
    capacity_report = []
    for (code, section), cap in capacities.items():
        if cap is None:
            continue
        remaining = remaining_caps.get((code, section), INF_CAP)
        if cap >= INF_CAP:
            # Capacidad infinita no se reporta
            continue
        assigned = cap - remaining
        capacity_report.append({
            'course': code,
            'section': section,
            'capacity': cap,
            'assigned': assigned,
            'remaining': remaining,
            'over_capacity': remaining < 0
        })

    return results, capacity_report
