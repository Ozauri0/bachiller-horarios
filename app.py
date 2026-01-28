from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
from itertools import product
import os
import json
from io import BytesIO
import hashlib

app = Flask(__name__)

# Cache busting: genera hash de archivos estáticos para forzar actualización en hotfixes
def get_file_hash(filename):
    """Genera hash MD5 del archivo para cache busting en producción"""
    filepath = os.path.join(app.static_folder, filename)
    if os.path.exists(filepath):
        try:
            with open(filepath, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()[:8]
        except:
            return 'dev'
    return 'dev'

@app.context_processor
def inject_file_versions():
    """Inyecta versiones de archivos estáticos en todas las plantillas"""
    return {
        'css_v': get_file_hash('styles.css'),
        'js_v': get_file_hash('app.js')
    }

# Cargar datos desde consolidado.xlsx
def load_consolidado():
    """Carga todos los horarios desde consolidado.xlsx"""
    excel_path = os.path.join(os.path.dirname(__file__), 'consolidado.xlsx')
    df = pd.read_excel(excel_path)
    
    # Las columnas son: sare_anho, sare_semestre, uaca_codigo, uaca_nombre, sree_codigo, 
    # sree_nombre, sacu_codigo, asig_codigo, asig_nombre, psec_codigo, pgru_codigo,
    # sper_hora_fin, sper_hora_ini, sdia_descripcion, camp_campus, tsal_tipo, 
    # ambiente_especifico, sare_comentario
    
    # Filtrar filas vacías
    df = df.dropna(subset=['asig_codigo'])
    
    # Limpiar datos
    df['asig_codigo'] = df['asig_codigo'].astype(str).str.strip()
    df['asig_nombre'] = df['asig_nombre'].astype(str).str.strip()
    df['psec_codigo'] = df['psec_codigo'].fillna(1).astype(int)
    df['pgru_codigo'] = df['pgru_codigo'].fillna(1).astype(int)
    df['sdia_descripcion'] = df['sdia_descripcion'].astype(str).str.strip()
    df['camp_campus'] = df['camp_campus'].astype(str).str.strip().str.upper()
    df['sper_hora_ini'] = df['sper_hora_ini'].astype(str).str.strip()
    df['sper_hora_fin'] = df['sper_hora_fin'].astype(str).str.strip()
    
    print(f"Total registros en consolidado: {len(df)}")
    print(f"Cursos únicos: {df['asig_codigo'].nunique()}")
    
    return df

# Normalizar campus
def normalize_campus(campus):
    campus = str(campus).upper()
    if 'ALEMANIA' in campus or 'RIVAS' in campus:
        return 'ALEMANIA'
    elif 'SAN JUAN PABLO' in campus or 'JUAN PABLO' in campus or 'SJPII' in campus or 'CJP' in campus:
        return 'SAN_JUAN_PABLO'
    elif 'VIRTUAL' in campus or 'ONLINE' in campus:
        return 'VIRTUAL'
    else:
        return 'OTRO'

# Convertir hora string a minutos desde medianoche
def time_to_minutes(time_str):
    try:
        time_str = str(time_str).strip()
        parts = time_str.split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except:
        return 0

# Verificar si dos bloques de tiempo se solapan
def blocks_overlap(block1, block2):
    """Verifica si dos bloques de horario se solapan"""
    if block1['dia'] != block2['dia']:
        return False
    
    start1 = time_to_minutes(block1['hora_ini'])
    end1 = time_to_minutes(block1['hora_fin'])
    start2 = time_to_minutes(block2['hora_ini'])
    end2 = time_to_minutes(block2['hora_fin'])
    
    return not (end1 <= start2 or end2 <= start1)

# Verificar tiempo de traslado entre campus
def check_travel_time(block1, block2):
    """
    Verifica si hay suficiente tiempo de traslado entre dos bloques.
    - San Juan Pablo II requiere 30 minutos con cualquier otro campus
    - Otros campus entre sí requieren 10 minutos
    - Virtual no tiene restricción
    Retorna: (es_valido, mensaje_error o None)
    """
    if block1['dia'] != block2['dia']:
        return True, None
    
    campus1 = normalize_campus(block1['campus'])
    campus2 = normalize_campus(block2['campus'])
    
    # Si alguno es virtual, no hay problema de traslado
    if campus1 == 'VIRTUAL' or campus2 == 'VIRTUAL':
        return True, None
    
    # Si son el mismo campus, no hay problema
    if campus1 == campus2:
        return True, None
    
    # Calcular tiempos
    end1 = time_to_minutes(block1['hora_fin'])
    start2 = time_to_minutes(block2['hora_ini'])
    end2 = time_to_minutes(block2['hora_fin'])
    start1 = time_to_minutes(block1['hora_ini'])
    
    # Determinar tiempo requerido
    # Si uno de los campus es San Juan Pablo II, necesita 30 minutos
    if campus1 == 'SAN_JUAN_PABLO' or campus2 == 'SAN_JUAN_PABLO':
        tiempo_requerido = 30
        tipo_topon = 'Topón de campus (San Juan Pablo II)'
    else:
        tiempo_requerido = 10
        tipo_topon = 'Topón de campus'
    
    # Verificar en ambas direcciones
    if end1 <= start2:
        if (start2 - end1) >= tiempo_requerido:
            return True, None
        else:
            return False, f"{tipo_topon}: {block1['curso']} ({block1['campus']}) y {block2['curso']} ({block2['campus']}) - necesitan {tiempo_requerido} min"
    elif end2 <= start1:
        if (start1 - end2) >= tiempo_requerido:
            return True, None
        else:
            return False, f"{tipo_topon}: {block2['curso']} ({block2['campus']}) y {block1['curso']} ({block1['campus']}) - necesitan {tiempo_requerido} min"
    
    return True, None

# Verificar si un bloque coincide con un topón válido configurado
def is_valid_topon(block1, block2, valid_topones):
    """
    Verifica si el topón entre block1 y block2 está en la lista de topones válidos.
    Un topón es válido si uno de los bloques es de BACH1121 y coincide con un topón configurado.
    
    Para topón "completo": el otro curso debe cubrir EXACTAMENTE el mismo horario de BACH1121
    Para topón "parcial": el otro curso puede cubrir parcialmente el horario de BACH1121
    
    Retorna: (es_topon_valido, tipo_topon)
    """
    if not valid_topones:
        return False, None
    
    # Verificar si alguno de los bloques es BACH1121
    bach_block = None
    other_block = None
    
    if block1['curso'] == 'BACH1121':
        bach_block = block1
        other_block = block2
    elif block2['curso'] == 'BACH1121':
        bach_block = block2
        other_block = block1
    else:
        return False, None
    
    # Buscar si este bloque de BACH1121 está en los topones válidos
    for topon_key, topon in valid_topones.items():
        if (int(topon['section']) == int(bach_block['seccion']) and
            str(topon['dia']) == str(bach_block['dia']) and
            str(topon['hora_ini']) == str(bach_block['hora_ini']) and
            str(topon['hora_fin']) == str(bach_block['hora_fin'])):
            
            tapon_type = topon.get('tapon_type', 'completo')
            
            # Para topón completo, el otro curso debe cubrir TODO el horario de BACH1121
            if tapon_type == 'completo':
                bach_start = time_to_minutes(bach_block['hora_ini'])
                bach_end = time_to_minutes(bach_block['hora_fin'])
                other_start = time_to_minutes(other_block['hora_ini'])
                other_end = time_to_minutes(other_block['hora_fin'])
                
                # El otro curso debe empezar igual o antes y terminar igual o después
                if other_start <= bach_start and other_end >= bach_end:
                    return True, 'completo'
                else:
                    # Es un topón parcial aunque se configuró como completo
                    return True, 'parcial'
            else:
                # Para topón parcial, cualquier solapamiento es válido
                return True, 'parcial'
    
    return False, None

# Verificar si una combinación de secciones es válida
def is_valid_combination(sections_blocks, valid_topones=None):
    """
    Verifica si una combinación de secciones es válida.
    sections_blocks: lista de listas de bloques (cada curso tiene sus bloques)
    valid_topones: dict con topones válidos configurados para BACH1121
    Retorna: (es_valido, lista_de_conflictos, lista_de_topones_validos)
    """
    all_blocks = []
    for blocks in sections_blocks:
        all_blocks.extend(blocks)
    
    conflicts = []
    valid_topones_found = []
    
    # Verificar cada par de bloques
    for i in range(len(all_blocks)):
        for j in range(i + 1, len(all_blocks)):
            # Verificar solapamiento
            if blocks_overlap(all_blocks[i], all_blocks[j]):
                # Verificar si es un topón válido
                is_valid, topon_type = is_valid_topon(all_blocks[i], all_blocks[j], valid_topones)
                if is_valid:
                    valid_topones_found.append({
                        'type': 'valid_topon',
                        'topon_type': topon_type,  # 'completo' o 'parcial'
                        'block1': all_blocks[i],
                        'block2': all_blocks[j],
                        'message': f"Topón válido ({topon_type}): {all_blocks[i]['curso']} y {all_blocks[j]['curso']} el {all_blocks[i]['dia']}"
                    })
                else:
                    conflicts.append({
                        'type': 'overlap',
                        'block1': all_blocks[i],
                        'block2': all_blocks[j],
                        'message': f"Topón horario: {all_blocks[i]['curso']} y {all_blocks[j]['curso']} el {all_blocks[i]['dia']}"
                    })
            else:
                # Verificar tiempo de traslado entre campus
                travel_ok, travel_msg = check_travel_time(all_blocks[i], all_blocks[j])
                if not travel_ok:
                    conflicts.append({
                        'type': 'travel_time',
                        'block1': all_blocks[i],
                        'block2': all_blocks[j],
                        'message': travel_msg
                    })
    
    return len(conflicts) == 0, conflicts, valid_topones_found

# Calcular score de un horario (para ordenar por "mejor" horario)
def calculate_schedule_score(sections_blocks):
    """
    Calcula un puntaje para el horario. Mayor puntaje = mejor horario.
    """
    all_blocks = []
    for blocks in sections_blocks:
        all_blocks.extend(blocks)
    
    if not all_blocks:
        return 0
    
    # Contar días únicos
    days = set(b['dia'] for b in all_blocks)
    days_score = (7 - len(days)) * 100  # Menos días = mejor
    
    # Calcular tiempo muerto por día
    dead_time = 0
    for day in days:
        day_blocks = sorted([b for b in all_blocks if b['dia'] == day], 
                          key=lambda x: time_to_minutes(x['hora_ini']))
        for i in range(len(day_blocks) - 1):
            end_current = time_to_minutes(day_blocks[i]['hora_fin'])
            start_next = time_to_minutes(day_blocks[i + 1]['hora_ini'])
            dead_time += max(0, start_next - end_current)
    
    dead_time_score = -dead_time  # Menos tiempo muerto = mejor
    
    # Horarios más temprano
    avg_start = sum(time_to_minutes(b['hora_ini']) for b in all_blocks) / len(all_blocks)
    early_score = -avg_start / 10  # Más temprano = mejor
    
    return days_score + dead_time_score + early_score

# Obtener lista de cursos únicos
def get_unique_courses(df):
    """Retorna cursos únicos del consolidado"""
    courses = df.groupby('asig_codigo').agg({
        'asig_nombre': 'first'
    }).reset_index()
    courses = courses.sort_values('asig_codigo')
    return courses.to_dict('records')

# Obtener secciones de un curso (considerando grupo)
def get_course_sections(df, course_code):
    """Retorna las secciones únicas de un curso"""
    course_df = df[df['asig_codigo'] == course_code]
    # Usar combinación de sección y grupo como identificador único
    sections = course_df.groupby(['psec_codigo', 'pgru_codigo']).size().reset_index()[['psec_codigo', 'pgru_codigo']]
    return sections.to_dict('records')

# Obtener bloques de una sección específica
def get_section_blocks(df, course_code, section, group):
    """Obtiene los bloques de horario para una sección y grupo específico"""
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

# Generar horarios posibles
def generate_schedules(df, selected_courses, group_configs=None, valid_topones=None, include_conflicts=True):
    """
    Genera todas las combinaciones posibles de horarios para los cursos seleccionados.
    group_configs: dict con configuraciones de grupos obligatorios por sección
                   Formato nuevo: {'CES1159_1': {course: 'CES1159', section: 1, groups: [0, 1]}}
                   Los grupos solo se mezclan dentro de la misma sección
    valid_topones: dict con topones válidos configurados para BACH1121
    """
    if not selected_courses:
        return []
    
    if group_configs is None:
        group_configs = {}
    
    if valid_topones is None:
        valid_topones = {}
    
    # Debug: imprimir configuración recibida
    print(f"DEBUG: group_configs recibido: {group_configs}")
    print(f"DEBUG: valid_topones recibido: {valid_topones}")
    
    # Convertir formato de configuración: agrupar por curso
    course_group_configs = {}
    for key, config in group_configs.items():
        course_code = config.get('course')
        section = config.get('section')
        groups = config.get('groups', [])
        
        print(f"DEBUG: Procesando config - curso: {course_code}, sección: {section}, grupos: {groups}")
        
        if course_code and section is not None and len(groups) >= 2:
            if course_code not in course_group_configs:
                course_group_configs[course_code] = {}
            # Asegurar que section sea int
            course_group_configs[course_code][int(section)] = [int(g) for g in groups]
    
    print(f"DEBUG: course_group_configs procesado: {course_group_configs}")
    
    # Para cada curso, obtener todas sus secciones con sus bloques
    course_sections = []
    for course_code in selected_courses:
        sections = get_course_sections(df, course_code)
        
        # Verificar si este curso tiene grupos obligatorios configurados
        if course_code in course_group_configs:
            section_configs = course_group_configs[course_code]
            
            # Agrupar secciones por psec_codigo
            sections_by_psec = {}
            for sec in sections:
                psec = sec['psec_codigo']
                if psec not in sections_by_psec:
                    sections_by_psec[psec] = []
                sections_by_psec[psec].append(sec)
            
            section_options = []
            for psec, sec_list in sections_by_psec.items():
                available_groups = [int(s['pgru_codigo']) for s in sec_list]
                psec_int = int(psec)  # Asegurar que sea int para comparar
                
                print(f"DEBUG: Verificando curso {course_code}, psec={psec_int}, available_groups={available_groups}")
                print(f"DEBUG: section_configs keys: {list(section_configs.keys())}")
                
                # Si esta sección tiene configuración de grupos combinados
                if psec_int in section_configs:
                    required_groups = section_configs[psec_int]
                    print(f"DEBUG: Sección {psec_int} TIENE config, required_groups={required_groups}")
                    # Verificar si todos los grupos requeridos están disponibles
                    if all(g in available_groups for g in required_groups):
                        # Combinar los bloques de todos los grupos requeridos
                        combined_blocks = []
                        for g in required_groups:
                            blocks = get_section_blocks(df, course_code, psec, g)
                            combined_blocks.extend(blocks)
                        
                        if combined_blocks:
                            print(f"DEBUG: Agregando combinación {course_code} sec {psec_int} grupos {required_groups}")
                            section_options.append({
                                'course': course_code,
                                'section': psec,
                                'group': '+'.join(map(str, required_groups)),
                                'is_combined': True,
                                'blocks': combined_blocks
                            })
                else:
                    print(f"DEBUG: Sección {psec_int} NO tiene config, usando grupos individuales")
                    # Esta sección no tiene config, usar grupos individuales
                    for sec in sec_list:
                        blocks = get_section_blocks(df, course_code, psec, sec['pgru_codigo'])
                        if blocks:
                            section_options.append({
                                'course': course_code,
                                'section': sec['psec_codigo'],
                                'group': sec['pgru_codigo'],
                                'is_combined': False,
                                'blocks': blocks
                            })
            
            if section_options:
                course_sections.append(section_options)
        else:
            # Comportamiento normal: cada grupo es una opción separada
            section_options = []
            for sec in sections:
                blocks = get_section_blocks(df, course_code, sec['psec_codigo'], sec['pgru_codigo'])
                if blocks:
                    section_options.append({
                        'course': course_code,
                        'section': sec['psec_codigo'],
                        'group': sec['pgru_codigo'],
                        'is_combined': False,
                        'blocks': blocks
                    })
            if section_options:
                course_sections.append(section_options)
    
    if len(course_sections) != len(selected_courses):
        # Algunos cursos no tienen secciones válidas
        return []
    
    # Generar todas las combinaciones posibles
    valid_schedules = []
    conflict_schedules = []
    valid_topon_schedules = []
    
    for combination in product(*course_sections):
        sections_blocks = [opt['blocks'] for opt in combination]
        is_valid, conflicts, valid_topones_found = is_valid_combination(sections_blocks, valid_topones)
        
        # Manejar grupo como string cuando es combinado
        sections_info = []
        for opt in combination:
            if opt.get('is_combined'):
                sections_info.append({
                    'course': str(opt['course']),
                    'section': int(opt['section']),
                    'group': str(opt['group'])  # Mantener como string "0+1"
                })
            else:
                sections_info.append({
                    'course': str(opt['course']),
                    'section': int(opt['section']),
                    'group': int(opt['group'])
                })
        
        schedule = {
            'sections': sections_info,
            'blocks': [block for opt in combination for block in opt['blocks']],
            'score': float(calculate_schedule_score(sections_blocks)),
            'has_conflicts': not is_valid,
            'has_valid_topones': len(valid_topones_found) > 0,
            'conflicts': [c['message'] for c in conflicts] if conflicts else [],
            'conflict_types': list(set(c['type'] for c in conflicts)) if conflicts else [],
            'valid_topones': [t['message'] for t in valid_topones_found] if valid_topones_found else [],
            'valid_topon_types': list(set(t['topon_type'] for t in valid_topones_found)) if valid_topones_found else []
        }
        
        if is_valid and len(valid_topones_found) > 0:
            # Horario válido pero con topones permitidos
            valid_topon_schedules.append(schedule)
        elif is_valid:
            valid_schedules.append(schedule)
        elif include_conflicts:
            conflict_schedules.append(schedule)
    
    # Ordenar por score
    valid_schedules.sort(key=lambda x: x['score'], reverse=True)
    valid_topon_schedules.sort(key=lambda x: x['score'], reverse=True)
    conflict_schedules.sort(key=lambda x: (len(x['conflicts']), -x['score']))
    
    # Combinar: primero válidos, luego con topones válidos, luego con conflictos
    all_schedules = valid_schedules
    all_schedules.extend(valid_topon_schedules)
    if include_conflicts:
        all_schedules.extend(conflict_schedules)
    
    return all_schedules

# Cargar datos al iniciar
df = load_consolidado()

@app.route('/')
def index():
    courses = get_unique_courses(df)
    return render_template('index.html', courses=courses)

@app.route('/api/courses')
def api_courses():
    courses = get_unique_courses(df)
    return jsonify(courses)

@app.route('/api/generate', methods=['POST'])
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
        
        schedules = generate_schedules(df, selected_courses, group_configs=group_configs, valid_topones=valid_topones, include_conflicts=True)
    except Exception as e:
        print(f"ERROR en api_generate: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error al generar horarios: {str(e)}'}), 500
    
    if not schedules:
        return jsonify({
            'success': False,
            'message': 'No se encontraron combinaciones de horarios',
            'schedules': []
        })
    
    valid_count = sum(1 for s in schedules if not s.get('has_conflicts', False) and not s.get('has_valid_topones', False))
    valid_topon_count = sum(1 for s in schedules if not s.get('has_conflicts', False) and s.get('has_valid_topones', False))
    conflict_count = sum(1 for s in schedules if s.get('has_conflicts', False))
    
    message = f'Se encontraron {valid_count} horarios sin topones'
    if valid_topon_count > 0:
        message += f', {valid_topon_count} con topones válidos'
    if conflict_count > 0:
        message += f' y {conflict_count} con topones inválidos'
    
    return jsonify({
        'success': True,
        'message': message,
        'schedules': schedules
    })

@app.route('/api/course/<course_code>/sections')
def api_course_sections(course_code):
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

@app.route('/api/course/<course_code>/structure')
def api_course_structure(course_code):
    """Obtiene la estructura de secciones y grupos de un curso para configuración"""
    sections = get_course_sections(df, course_code)
    # Agrupar por sección
    structure = {}
    for sec in sections:
        sec_code = int(sec['psec_codigo'])
        group_code = int(sec['pgru_codigo'])
        if sec_code not in structure:
            structure[sec_code] = []
        if group_code not in structure[sec_code]:
            structure[sec_code].append(group_code)
    
    # Convertir a lista ordenada
    result = []
    for sec_code in sorted(structure.keys()):
        result.append({
            'section': sec_code,
            'groups': sorted(structure[sec_code])
        })
    
    return jsonify(result)

@app.route('/api/config/load', methods=['GET'])
def api_load_config():
    """Carga la configuración guardada desde el archivo JSON"""
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            return jsonify(config)
        except Exception as e:
            print(f"Error cargando config: {str(e)}")
            return jsonify({'groupConfigs': {}, 'toponesConfigs': {}})
    else:
        return jsonify({'groupConfigs': {}, 'toponesConfigs': {}})

@app.route('/api/config/save', methods=['POST'])
def api_save_config():
    """Guarda la configuración en un archivo JSON"""
    try:
        data = request.json
        config_path = os.path.join(os.path.dirname(__file__), 'config.json')
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': 'Configuración guardada correctamente'})
    except Exception as e:
        print(f"Error guardando config: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/bach1121/schedules')
def api_bach1121_schedules():
    """Obtiene todos los horarios individuales de BACH1121 para configurar topones válidos"""
    course_code = 'BACH1121'
    
    # Filtrar solo BACH1121
    bach_df = df[df['asig_codigo'] == course_code]
    
    if bach_df.empty:
        return jsonify([])
    
    # Crear una lista de cada horario individual
    result = []
    
    for _, row in bach_df.iterrows():
        sec = int(row['psec_codigo'])
        grp = int(row['pgru_codigo'])
        dia = str(row['sdia_descripcion'])
        hora_ini = str(row['sper_hora_ini'])
        hora_fin = str(row['sper_hora_fin'])
        campus = str(row['camp_campus'])
        
        # Determinar tipo de tapón (completo para secciones 1-4, parcial para otras)
        tapon_type = 'completo' if sec in [1, 2, 3, 4] else 'parcial'
        
        # ID único para este horario
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
    
    # Ordenar por sección, día y hora
    dias_orden = {'Lunes': 1, 'Martes': 2, 'Miercoles': 3, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sabado': 6, 'Sábado': 6}
    result.sort(key=lambda x: (x['section'], dias_orden.get(x['dia'], 99), x['hora_ini']))
    
    return jsonify(result)

@app.route('/api/data/all')
def api_get_all_data():
    """Obtiene todos los datos del Excel para edición"""
    try:
        # Convertir el DataFrame a lista de diccionarios
        data = df.to_dict('records')
        
        # Convertir valores NaN a None para JSON
        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
        
        return jsonify({
            'success': True,
            'data': data,
            'total': len(data)
        })
    except Exception as e:
        print(f"Error obteniendo datos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/data/save', methods=['POST'])
def api_save_data():
    """Guarda los datos editados en el Excel"""
    global df
    try:
        data = request.json.get('data', [])
        
        if not data:
            return jsonify({'success': False, 'error': 'No se recibieron datos'}), 400
        
        # Crear nuevo DataFrame con los datos recibidos
        new_df = pd.DataFrame(data)
        
        # Guardar en el archivo Excel
        excel_path = os.path.join(os.path.dirname(__file__), 'consolidado.xlsx')
        new_df.to_excel(excel_path, index=False)
        
        # Recargar el DataFrame global
        df = load_consolidado()
        
        return jsonify({
            'success': True,
            'message': 'Datos guardados correctamente',
            'total': len(new_df)
        })
    except Exception as e:
        print(f"Error guardando datos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/data/export')
def api_export_data():
    """Exporta el Excel actual"""
    try:
        excel_path = os.path.join(os.path.dirname(__file__), 'consolidado.xlsx')
        return send_file(
            excel_path,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='consolidado_export.xlsx'
        )
    except Exception as e:
        print(f"Error exportando datos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/data/import', methods=['POST'])
def api_import_data():
    """Importa un archivo Excel y reemplaza los datos actuales"""
    global df
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No se recibió ningún archivo'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Nombre de archivo vacío'}), 400
        
        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({'success': False, 'error': 'El archivo debe ser un Excel (.xlsx o .xls)'}), 400
        
        # Leer el archivo Excel cargado
        imported_df = pd.read_excel(file)
        
        # Validar que tenga las columnas esperadas
        required_columns = ['asig_codigo', 'asig_nombre', 'psec_codigo', 'pgru_codigo', 
                          'sdia_descripcion', 'sper_hora_ini', 'sper_hora_fin', 'camp_campus']
        
        missing_columns = [col for col in required_columns if col not in imported_df.columns]
        if missing_columns:
            return jsonify({
                'success': False, 
                'error': f'Faltan columnas requeridas: {", ".join(missing_columns)}'
            }), 400
        
        # Guardar el archivo importado
        excel_path = os.path.join(os.path.dirname(__file__), 'consolidado.xlsx')
        imported_df.to_excel(excel_path, index=False)
        
        # Recargar el DataFrame global
        df = load_consolidado()
        
        return jsonify({
            'success': True,
            'message': 'Archivo importado correctamente',
            'total': len(imported_df)
        })
    except Exception as e:
        print(f"Error importando datos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
