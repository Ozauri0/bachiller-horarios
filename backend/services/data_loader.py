import pandas as pd
from backend.utils.constants import DATA_DIR


def normalize_consolidado(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normaliza cualquier formato oficial de consolidado a columnas estándar:
    asig_codigo, asig_nombre, psec_codigo, pgru_codigo, sdia_descripcion,
    sper_hora_ini, sper_hora_fin, camp_campus, más campos opcionales.
    Soporta:
      - consolidado.xlsx tradicional (asig_codigo, sdia_descripcion, ...)
      - Formato nuevo con columnas en español (CODIGO CURSO, HORA INICIO, ...)
      - Horarios 2026 reporte.xlsx (20 columnas con hora_ini/hora_fin/dia/campus)
    """
    df = df.rename(columns=lambda c: str(c).strip().lower().replace(' ', '_'))
    cols = set(df.columns)

    old_format = {'asig_codigo', 'asig_nombre', 'psec_codigo', 'pgru_codigo', 'sdia_descripcion', 'sper_hora_ini', 'sper_hora_fin', 'camp_campus'}.issubset(cols)
    new_format = {'codigo_curso', 'nombre_curso', 'seccion', 'grupo', 'dia', 'hora_inicio', 'hora_fin', 'campus'}.issubset(cols)
    reporte_format = {'sare_codigo', 'sare_anho', 'sare_semestre', 'uaca_codigo', 'uaca_nombre', 'sree_codigo', 'sree_nombre', 'sacu_codigo', 'asig_codigo', 'asig_nombre', 'psec_codigo', 'pgru_codigo', 'hora_fin', 'hora_ini', 'dia', 'campus', 'tipo_sala', 'ambiente', 'comentario'}.issubset(cols)

    if new_format:
        df = df.rename(columns={
            'codigo_curso': 'asig_codigo',
            'nombre_curso': 'asig_nombre',
            'seccion': 'psec_codigo',
            'grupo': 'pgru_codigo',
            'dia': 'sdia_descripcion',
            'hora_inicio': 'sper_hora_ini',
            'hora_fin': 'sper_hora_fin',
            'campus': 'camp_campus',
        })
        df['sare_anho'] = df.get('sare_anho', 2026)
        df['sare_semestre'] = df.get('sare_semestre', None)
        df['uaca_codigo'] = df.get('uaca_codigo', None)
        df['uaca_nombre'] = df.get('uaca_nombre', None)
        df['sree_codigo'] = df.get('sree_codigo', None)
        df['sree_nombre'] = df.get('sree_nombre', None)
        df['sacu_codigo'] = df.get('sacu_codigo', None)
        df['tsal_tipo'] = df.get('tsal_tipo', None)
        df['ambiente_especifico'] = df.get('ambiente_especifico', None)
        df['sare_comentario'] = df.get('sare_comentario', None)
    elif reporte_format:
        df = df.rename(columns={
            'hora_ini': 'sper_hora_ini',
            'hora_fin': 'sper_hora_fin',
            'dia': 'sdia_descripcion',
            'campus': 'camp_campus',
            'tipo_sala': 'tsal_tipo',
            'ambiente': 'ambiente_especifico',
            'comentario': 'sare_comentario'
        })
    elif old_format:
        # Ya está en formato estándar
        pass
    else:
        raise ValueError(
            'Formato no reconocido. Usa consolidado.xlsx tradicional o Horarios 2026 reporte.xlsx. '
            'Columnas esperadas: asig_codigo/asig_nombre/... o codigo_curso/nombre_curso/... o el layout de 20 columnas (hora_ini/hora_fin/dia/campus).'
        )

    df = df.dropna(subset=['asig_codigo'])

    df['asig_codigo'] = df['asig_codigo'].astype(str).str.strip()
    df['asig_nombre'] = df['asig_nombre'].astype(str).str.strip()
    df['psec_codigo'] = df['psec_codigo'].fillna(1).astype(int)
    df['pgru_codigo'] = df['pgru_codigo'].fillna(1).astype(int)
    df['sdia_descripcion'] = df['sdia_descripcion'].astype(str).str.strip()
    df['camp_campus'] = df['camp_campus'].astype(str).str.strip().str.upper()

    df['sdia_descripcion'] = df['sdia_descripcion'].apply(_normalize_day)
    df['sper_hora_ini'] = df['sper_hora_ini'].apply(_format_time)
    df['sper_hora_fin'] = df['sper_hora_fin'].apply(_format_time)

    print(f"Total registros en consolidado normalizado: {len(df)}")
    print(f"Cursos únicos: {df['asig_codigo'].nunique()}")

    return df


def load_consolidado():
    """Carga todos los horarios desde data/consolidado.xlsx"""
    excel_path = DATA_DIR / 'consolidado.xlsx'
    df = pd.read_excel(excel_path)
    df = normalize_consolidado(df)
    return df


def _normalize_day(day):
    if pd.isna(day):
        return 'Lunes'
    day = str(day).strip().lower()
    day_mapping = {
        'lunes': 'Lunes',
        'martes': 'Martes',
        'miercoles': 'Miercoles',
        'miércoles': 'Miercoles',
        'jueves': 'Jueves',
        'viernes': 'Viernes',
        'sabado': 'Sabado',
        'sábado': 'Sabado',
        'domingo': 'Domingo'
    }
    return day_mapping.get(day, day.capitalize())


def _format_time(time_val):
    if pd.isna(time_val):
        return '00:00'
    if isinstance(time_val, pd.Timestamp):
        return time_val.strftime('%H:%M')
    time_str = str(time_val).strip()
    if len(time_str) == 8 and time_str.count(':') == 2:
        return time_str[:5]
    return time_str


def get_unique_courses(df):
    courses = df.groupby('asig_codigo').agg({'asig_nombre': 'first'}).reset_index()
    courses = courses.sort_values('asig_codigo')
    return courses.to_dict('records')


def get_course_sections(df, course_code):
    course_df = df[df['asig_codigo'] == course_code]
    sections = course_df.groupby(['psec_codigo', 'pgru_codigo']).size().reset_index()[['psec_codigo', 'pgru_codigo']]
    return sections.to_dict('records')


def normalize_campus(campus):
    campus = str(campus).upper()
    if 'ALEMANIA' in campus or 'RIVAS' in campus:
        return 'ALEMANIA'
    if 'SAN JUAN PABLO' in campus or 'JUAN PABLO' in campus or 'SJPII' in campus or 'CJP' in campus:
        return 'SAN_JUAN_PABLO'
    if 'VIRTUAL' in campus or 'ONLINE' in campus:
        return 'VIRTUAL'
    return 'OTRO'


def time_to_minutes(time_str):
    try:
        time_str = str(time_str).strip()
        parts = time_str.split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0


def get_section_blocks(df, course_code, section, group):
    section_df = df[(df['asig_codigo'] == course_code) &
                    (df['psec_codigo'] == section) &
                    (df['pgru_codigo'] == group)]
    blocks = []
    for _, row in section_df.iterrows():
        blocks.append({
            'curso': str(course_code),
            'nombre': str(row['asig_nombre']),
            'seccion': int(section),
            'grupo': int(group),
            'dia': str(row['sdia_descripcion']).strip().upper(),
            'hora_ini': str(row['sper_hora_ini']),
            'hora_fin': str(row['sper_hora_fin']),
            'campus': str(row['camp_campus']),
            'hora_ini_min': time_to_minutes(row['sper_hora_ini']),
            'hora_fin_min': time_to_minutes(row['sper_hora_fin']),
            'campus_norm': normalize_campus(row['camp_campus'])
        })
    return blocks
