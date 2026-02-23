from flask import Blueprint, jsonify, request, current_app
from backend.services.data_loader import get_unique_courses, get_course_sections, get_section_blocks
from backend.services.schedules import generate_schedules

schedules_bp = Blueprint('schedules', __name__)


@schedules_bp.route('/courses')
def api_courses():
    df = current_app.config['DATAFRAME']
    courses = get_unique_courses(df)
    return jsonify(courses)


@schedules_bp.route('/generate', methods=['POST'])
def api_generate():
    try:
        data = request.json
        selected_courses = data.get('courses', [])
        group_configs = data.get('groupConfigs', {})
        valid_topones = data.get('validTopones', {})

        print(f"DEBUG - Courses: {selected_courses}")
        print(f"DEBUG - Group configs: {group_configs}")
        print(f"DEBUG - Valid topones: {valid_topones}")

        if len(selected_courses) > 6:
            return jsonify({'error': 'Máximo 6 cursos permitidos'}), 400
        if len(selected_courses) == 0:
            return jsonify({'error': 'Selecciona al menos un curso'}), 400

        df = current_app.config['DATAFRAME']
        schedules, stats = generate_schedules(
            df,
            selected_courses,
            group_configs=group_configs,
            valid_topones=valid_topones,
            include_conflicts=True
        )
    except Exception as e:
        print(f"ERROR en api_generate: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error al generar horarios: {str(e)}'}), 500

    if not schedules:
        return jsonify({
            'success': False,
            'message': 'No se encontraron combinaciones de horarios',
            'schedules': [],
            'stats': stats
        })

    valid_count = stats.get('total_valid', 0)
    valid_topon_count = stats.get('total_valid_topon', 0)
    conflict_count = stats.get('total_conflicts_returned', 0)
    conflict_total = stats.get('total_conflicts_found', conflict_count)
    conflicts_truncated = stats.get('conflicts_truncated', False)

    message = f'Se encontraron {valid_count} horarios sin topones'
    if valid_topon_count > 0:
        message += f', {valid_topon_count} con topones válidos'
    if conflict_count > 0:
        conflict_label = f'{conflict_count}'
        if conflicts_truncated and conflict_total > conflict_count:
            conflict_label = f'{conflict_count} de {conflict_total}'
        message += f' y {conflict_label} con topones inválidos'

    return jsonify({
        'success': True,
        'message': message,
        'schedules': schedules,
        'stats': stats
    })


@schedules_bp.route('/course/<course_code>/sections')
def api_course_sections(course_code):
    df = current_app.config['DATAFRAME']
    sections = get_course_sections(df, course_code)
    result = []
    for sec in sections:
        blocks = get_section_blocks(df, course_code, sec['psec_codigo'], sec['pgru_codigo'])
        result.append({
            'section': sec['psec_codigo'],
            'group': sec['pgru_codigo'],
            'blocks': blocks
        })
    return jsonify(result)


@schedules_bp.route('/course/<course_code>/structure')
def api_course_structure(course_code):
    df = current_app.config['DATAFRAME']
    sections = get_course_sections(df, course_code)

    structure = {}
    for sec in sections:
        sec_code = int(sec['psec_codigo'])
        group_code = int(sec['pgru_codigo'])
        if sec_code not in structure:
            structure[sec_code] = []
        if group_code not in structure[sec_code]:
            structure[sec_code].append(group_code)

    result = []
    for sec_code in sorted(structure.keys()):
        result.append({
            'section': sec_code,
            'groups': sorted(structure[sec_code])
        })

    return jsonify(result)


@schedules_bp.route('/bach1121/schedules')
def api_bach1121_schedules():
    course_code = 'BACH1121'
    df = current_app.config['DATAFRAME']
    bach_df = df[df['asig_codigo'] == course_code]

    if bach_df.empty:
        return jsonify([])

    result = []
    for _, row in bach_df.iterrows():
        sec = int(row['psec_codigo'])
        grp = int(row['pgru_codigo'])
        dia = str(row['sdia_descripcion'])
        hora_ini = str(row['sper_hora_ini'])
        hora_fin = str(row['sper_hora_fin'])
        campus = str(row['camp_campus'])

        tapon_type = 'completo' if sec in [1, 2, 3, 4] else 'parcial'
        horario_id = f"{sec}_{grp}_{dia}_{hora_ini}_{hora_fin}"

        result.append({
            'id': horario_id,
            'section': sec,
            'group': grp,
            'dia': dia,
            'hora_ini': hora_ini,
            'hora_fin': hora_fin,
            'tapon_type': tapon_type,
            'campus': campus,
            'display': f"Sección {sec} - {dia} {hora_ini} a {hora_fin} ({tapon_type})"
        })

    dias_orden = {'Lunes': 1, 'Martes': 2, 'Miercoles': 3, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sabado': 6, 'Sábado': 6}
    result.sort(key=lambda x: (x['section'], dias_orden.get(x['dia'], 99), x['hora_ini']))
    return jsonify(result)
