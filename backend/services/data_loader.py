import os
import pandas as pd
from backend.utils.constants import DATA_DIR


def load_consolidado():
    """Carga todos los horarios desde data/consolidado.xlsx"""
    excel_path = DATA_DIR / 'consolidado.xlsx'
    df = pd.read_excel(excel_path)

    # Detectar formato del Excel (nuevo o antiguo)
    if 'CODIGO CURSO' in df.columns:
        df = df.rename(columns={
            'CODIGO CURSO': 'asig_codigo',
            'NOMBRE CURSO': 'asig_nombre',
            'SECCION': 'psec_codigo',
            'GRUPO': 'pgru_codigo',
            'SEMESTRE': 'sare_semestre',
            'CAMPUS': 'camp_campus',
            'DIA': 'sdia_descripcion',
            'HORA INICIO': 'sper_hora_ini',
            'HORA FIN': 'sper_hora_fin'
        })

        df['sare_anho'] = 2026
        df['uaca_codigo'] = None
        df['uaca_nombre'] = None
        df['sree_codigo'] = None
        df['sree_nombre'] = None
        df['sacu_codigo'] = None
        df['tsal_tipo'] = None
        df['ambiente_especifico'] = None
        df['sare_comentario'] = None

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

    print(f"Total registros en consolidado: {len(df)}")
    print(f"Cursos únicos: {df['asig_codigo'].nunique()}")

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
            'dia': str(row['sdia_descripcion']),
            'hora_ini': str(row['sper_hora_ini']),
            'hora_fin': str(row['sper_hora_fin']),
            'campus': str(row['camp_campus'])
        })
    return blocks
