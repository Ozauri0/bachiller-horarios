import pandas as pd
from backend.services.schedules import generate_schedules
from backend.services.config_loader import load_saved_config
from backend.utils.constants import DATA_DIR


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
    # Si solo hay horarios con conflicto, devolver el primero para revisión
    if schedules:
        return schedules[0], None
    return None, None


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


def process_massive(base_df, alumnos_df, progress_cb=None):
    group_configs, valid_topones = load_saved_config()

    results = []
    grouped = alumnos_df.groupby('REGISTRO')
    total = len(grouped)

    for idx, (registro, group) in enumerate(grouped):
        registro_val = str(registro)
        rut_num = str(group['RUT'].iloc[0]).strip() if 'RUT' in group else ''
        dv_val = str(group['DV'].iloc[0]).strip() if 'DV' in group else ''
        rut = f"{rut_num}-{dv_val}" if rut_num else ''
        nombre = str(group['NOMBRE'].iloc[0]).strip() if 'NOMBRE' in group else ''
        ap_pat = str(group['APELLIDO PATERNO'].iloc[0]).strip() if 'APELLIDO PATERNO' in group else ''
        ap_mat = str(group['APELLIDO MATERNO'].iloc[0]).strip() if 'APELLIDO MATERNO' in group else ''
        nombre_completo = ' '.join(x for x in [nombre, ap_pat, ap_mat] if x).strip()

        course_meta = collect_course_meta(group)

        if progress_cb:
            progress_cb(idx, total, nombre_completo or registro_val, registro_val)

        course_codes = []
        for _, row in group.iterrows():
            code = str(row['CODIGO ASIGNATURA']).strip()
            if code and code not in course_codes:
                course_codes.append(code)

        # Construir df solo por cursos (ignorando sección/grupo de entrada)
        student_df, missing = build_student_df(base_df, course_codes)
        if missing:
            results.append({
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
            continue

        selected_courses = course_codes
        schedules, _stats = generate_schedules(
            student_df,
            selected_courses,
            group_configs=group_configs,
            valid_topones=valid_topones,
            include_conflicts=True
        )

        best, used_topon = pick_best_schedule(schedules)
        if not best:
            results.append({
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
            continue

        courses_detail = []
        for sec in best.get('sections', []):
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
        if best.get('has_conflicts'):
            status = 'no_valido'
            message = 'Horario generado con conflictos para revisión'
        elif used_topon:
            message = 'Horario asignado con topones válidos'

        results.append({
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
            'sections': best.get('sections', []),
            'blocks': best.get('blocks', []),
            'courses_detail': courses_detail,
            'has_conflicts': best.get('has_conflicts', False),
            'conflict_types': best.get('conflict_types', []),
            'valid_topones': best.get('valid_topones', []),
            'valid_topon_types': best.get('valid_topon_types', []),
            'has_valid_topones': used_topon,
            'conflicts': best.get('conflicts', [])
        })

    return results
