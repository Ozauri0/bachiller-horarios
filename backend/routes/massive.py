import threading
from flask import Blueprint, jsonify, request, current_app
from backend.services.massive import load_alumnos_dataframe, process_massive
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
    'error': None
}


@mass_bp.route('/mass/generate', methods=['POST'])
def api_mass_generate():
    try:
        upload = request.files.get('file') if 'file' in request.files else None
        if upload and upload.filename:
            save_path = DATA_DIR / 'alumnos.xlsx'
            upload.save(save_path)

        alumnos_df = load_alumnos_dataframe(upload)
        base_df = current_app.config['DATAFRAME']

        results = process_massive(base_df, alumnos_df)
        total = len(results)
        with_schedule = sum(1 for r in results if r['status'] == 'con_horario')
        without_schedule = total - with_schedule
        with_valid_topon = sum(1 for r in results if r.get('has_valid_topones'))

        summary = {
            'total_alumnos': total,
            'con_horario': with_schedule,
            'sin_horario': without_schedule,
            'con_topon_valido': with_valid_topon
        }

        return jsonify({
            'success': True,
            'summary': summary,
            'results': results
        })
    except Exception as e:
        print(f"ERROR en carga masiva: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


def _progress_cb(idx, total, name, registro):
    MASS_STATE['current'] = idx + 1
    MASS_STATE['total'] = total
    MASS_STATE['current_name'] = name
    MASS_STATE['current_registro'] = registro


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
            'current_registro': ''
        })

        results = process_massive(base_df, alumnos_df, progress_cb=_progress_cb)
        total = len(results)
        with_schedule = sum(1 for r in results if r['status'] == 'con_horario')
        without_schedule = total - with_schedule
        with_valid_topon = sum(1 for r in results if r.get('has_valid_topones'))

        summary = {
            'total_alumnos': total,
            'con_horario': with_schedule,
            'sin_horario': without_schedule,
            'con_topon_valido': with_valid_topon
        }

        MASS_STATE.update({
            'running': False,
            'results': results,
            'summary': summary,
            'error': None
        })
    except Exception as e:
        MASS_STATE.update({
            'running': False,
            'results': None,
            'summary': None,
            'error': str(e)
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
            'current_registro': ''
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
            'error': str(e)
        })
        return jsonify({'success': False, 'error': str(e)}), 500


@mass_bp.route('/mass/progress', methods=['GET'])
def api_mass_progress():
    state = MASS_STATE.copy()
    state['remaining'] = max(state.get('total', 0) - state.get('current', 0), 0)
    state['done'] = not state.get('running') and state.get('results') is not None
    return jsonify({'success': True, 'state': state})
