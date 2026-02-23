from itertools import product
from backend.utils.constants import MAX_CONFLICT_SCHEDULES
from backend.services.data_loader import get_course_sections, get_section_blocks


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


def blocks_overlap(block1, block2):
    day1 = str(block1['dia']).strip().upper()
    day2 = str(block2['dia']).strip().upper()
    if day1 != day2:
        return False

    start1 = time_to_minutes(block1['hora_ini'])
    end1 = time_to_minutes(block1['hora_fin'])
    start2 = time_to_minutes(block2['hora_ini'])
    end2 = time_to_minutes(block2['hora_fin'])

    return not (end1 <= start2 or end2 <= start1)


def check_travel_time(block1, block2):
    day1 = str(block1['dia']).strip().upper()
    day2 = str(block2['dia']).strip().upper()
    if day1 != day2:
        return True, None

    campus1 = normalize_campus(block1['campus'])
    campus2 = normalize_campus(block2['campus'])

    if campus1 == 'VIRTUAL' or campus2 == 'VIRTUAL':
        return True, None
    if campus1 == campus2:
        return True, None

    end1 = time_to_minutes(block1['hora_fin'])
    start2 = time_to_minutes(block2['hora_ini'])
    end2 = time_to_minutes(block2['hora_fin'])
    start1 = time_to_minutes(block1['hora_ini'])

    if campus1 == 'SAN_JUAN_PABLO' or campus2 == 'SAN_JUAN_PABLO':
        tiempo_requerido = 30
        tipo_topon = 'Topón de campus (San Juan Pablo II)'
    else:
        tiempo_requerido = 10
        tipo_topon = 'Topón de campus'

    if end1 <= start2:
        if (start2 - end1) >= tiempo_requerido:
            return True, None
        return False, f"{tipo_topon}: {block1['curso']} ({block1['campus']}) y {block2['curso']} ({block2['campus']}) - necesitan {tiempo_requerido} min"
    if end2 <= start1:
        if (start1 - end2) >= tiempo_requerido:
            return True, None
        return False, f"{tipo_topon}: {block2['curso']} ({block2['campus']}) y {block1['curso']} ({block1['campus']}) - necesitan {tiempo_requerido} min"

    return True, None


def is_valid_topon(block1, block2, valid_topones):
    if not valid_topones:
        return False, None

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

    for _, topon in valid_topones.items():
        if (int(topon['section']) == int(bach_block['seccion']) and
            str(topon['dia']) == str(bach_block['dia']) and
            str(topon['hora_ini']) == str(bach_block['hora_ini']) and
            str(topon['hora_fin']) == str(bach_block['hora_fin'])):

            tapon_type = topon.get('tapon_type', 'completo')

            if tapon_type == 'completo':
                bach_start = time_to_minutes(bach_block['hora_ini'])
                bach_end = time_to_minutes(bach_block['hora_fin'])
                other_start = time_to_minutes(other_block['hora_ini'])
                other_end = time_to_minutes(other_block['hora_fin'])

                if other_start <= bach_start and other_end >= bach_end:
                    return True, 'completo'
                return True, 'parcial'

            return True, 'parcial'

    return False, None


def is_valid_combination(sections_blocks, valid_topones=None):
    all_blocks = []
    for blocks in sections_blocks:
        all_blocks.extend(blocks)

    conflicts = []
    valid_topones_found = []

    for i in range(len(all_blocks)):
        for j in range(i + 1, len(all_blocks)):
            if blocks_overlap(all_blocks[i], all_blocks[j]):
                is_valid, topon_type = is_valid_topon(all_blocks[i], all_blocks[j], valid_topones)
                if is_valid:
                    valid_topones_found.append({
                        'type': 'valid_topon',
                        'topon_type': topon_type,
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
                travel_ok, travel_msg = check_travel_time(all_blocks[i], all_blocks[j])
                if not travel_ok:
                    conflicts.append({
                        'type': 'travel_time',
                        'block1': all_blocks[i],
                        'block2': all_blocks[j],
                        'message': travel_msg
                    })

    return len(conflicts) == 0, conflicts, valid_topones_found


def calculate_schedule_score(sections_blocks):
    all_blocks = []
    for blocks in sections_blocks:
        all_blocks.extend(blocks)

    if not all_blocks:
        return 0

    days = set(b['dia'] for b in all_blocks)
    days_score = (7 - len(days)) * 100

    dead_time = 0
    for day in days:
        day_blocks = sorted([b for b in all_blocks if b['dia'] == day], key=lambda x: time_to_minutes(x['hora_ini']))
        for i in range(len(day_blocks) - 1):
            end_current = time_to_minutes(day_blocks[i]['hora_fin'])
            start_next = time_to_minutes(day_blocks[i + 1]['hora_ini'])
            dead_time += max(0, start_next - end_current)

    dead_time_score = -dead_time
    avg_start = sum(time_to_minutes(b['hora_ini']) for b in all_blocks) / len(all_blocks)
    early_score = -avg_start / 10

    return days_score + dead_time_score + early_score


def generate_schedules(df, selected_courses, group_configs=None, valid_topones=None, include_conflicts=True):
    if not selected_courses:
        return [], {
            'total_valid': 0,
            'total_valid_topon': 0,
            'total_conflicts_found': 0,
            'total_conflicts_returned': 0,
            'conflict_limit': MAX_CONFLICT_SCHEDULES,
            'conflicts_truncated': False
        }

    if group_configs is None:
        group_configs = {}
    if valid_topones is None:
        valid_topones = {}

    print(f"DEBUG: group_configs recibido: {group_configs}")
    print(f"DEBUG: valid_topones recibido: {valid_topones}")

    course_group_configs = {}
    for _, config in group_configs.items():
        course_code = config.get('course')
        section = config.get('section')
        groups = config.get('groups', [])

        print(f"DEBUG: Procesando config - curso: {course_code}, sección: {section}, grupos: {groups}")

        if course_code and section is not None and len(groups) >= 2:
            if course_code not in course_group_configs:
                course_group_configs[course_code] = {}
            if int(section) not in course_group_configs[course_code]:
                course_group_configs[course_code][int(section)] = []
            course_group_configs[course_code][int(section)].append([int(g) for g in groups])

    print(f"DEBUG: course_group_configs procesado: {course_group_configs}")

    course_sections = []
    for course_code in selected_courses:
        sections = get_course_sections(df, course_code)

        if course_code in course_group_configs:
            section_configs = course_group_configs[course_code]
            sections_by_psec = {}
            for sec in sections:
                psec = sec['psec_codigo']
                sections_by_psec.setdefault(psec, []).append(sec)

            section_options = []
            for psec, sec_list in sections_by_psec.items():
                available_groups = [int(s['pgru_codigo']) for s in sec_list]
                psec_int = int(psec)

                print(f"DEBUG: Verificando curso {course_code}, psec={psec_int}, available_groups={available_groups}")
                print(f"DEBUG: section_configs keys: {list(section_configs.keys())}")

                if psec_int in section_configs:
                    required_groups_list = section_configs[psec_int]
                    print(f"DEBUG: Sección {psec_int} TIENE configs, required_groups_list={required_groups_list}")

                    for required_groups in required_groups_list:
                        if all(g in available_groups for g in required_groups):
                            combined_blocks = []
                            for g in required_groups:
                                blocks = get_section_blocks(df, course_code, psec, g)
                                combined_blocks.extend(blocks)

                            if combined_blocks:
                                groups_display = '+'.join(map(str, required_groups))
                                print(f"DEBUG: Agregando combinación {course_code} sec {psec_int} grupos {required_groups}")
                                section_options.append({
                                    'course': course_code,
                                    'section': psec,
                                    'group': groups_display,
                                    'is_combined': True,
                                    'blocks': combined_blocks
                                })
                else:
                    print(f"DEBUG: Sección {psec_int} NO tiene config, usando grupos individuales")
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
        return [], {
            'total_valid': 0,
            'total_valid_topon': 0,
            'total_conflicts_found': 0,
            'total_conflicts_returned': 0,
            'conflict_limit': MAX_CONFLICT_SCHEDULES,
            'conflicts_truncated': False
        }

    valid_schedules = []
    conflict_schedules = []
    valid_topon_schedules = []
    conflict_total = 0

    def build_schedule_entry(combination, sections_blocks, conflicts, valid_topones_found, is_valid_flag):
        sections_info = []
        for opt in combination:
            if opt.get('is_combined'):
                sections_info.append({
                    'course': str(opt['course']),
                    'section': int(opt['section']),
                    'group': str(opt['group'])
                })
            else:
                sections_info.append({
                    'course': str(opt['course']),
                    'section': int(opt['section']),
                    'group': int(opt['group'])
                })

        return {
            'sections': sections_info,
            'blocks': [block for opt in combination for block in opt['blocks']],
            'score': float(calculate_schedule_score(sections_blocks)),
            'has_conflicts': not is_valid_flag,
            'has_valid_topones': len(valid_topones_found) > 0,
            'conflicts': [c['message'] for c in conflicts] if conflicts else [],
            'conflict_types': list(set(c['type'] for c in conflicts)) if conflicts else [],
            'valid_topones': [t['message'] for t in valid_topones_found] if valid_topones_found else [],
            'valid_topon_types': list(set(t['topon_type'] for t in valid_topones_found)) if valid_topones_found else []
        }

    for combination in product(*course_sections):
        sections_blocks = [opt['blocks'] for opt in combination]
        is_valid, conflicts, valid_topones_found = is_valid_combination(sections_blocks, valid_topones)

        if is_valid and len(valid_topones_found) > 0:
            valid_topon_schedules.append(build_schedule_entry(combination, sections_blocks, conflicts, valid_topones_found, True))
        elif is_valid:
            valid_schedules.append(build_schedule_entry(combination, sections_blocks, conflicts, valid_topones_found, True))
        elif include_conflicts:
            conflict_total += 1
            if len(conflict_schedules) < MAX_CONFLICT_SCHEDULES:
                conflict_schedules.append(build_schedule_entry(combination, sections_blocks, conflicts, valid_topones_found, False))

    valid_schedules.sort(key=lambda x: x['score'], reverse=True)
    valid_topon_schedules.sort(key=lambda x: x['score'], reverse=True)
    conflict_schedules.sort(key=lambda x: (len(x['conflicts']), -x['score']))

    all_schedules = valid_schedules
    all_schedules.extend(valid_topon_schedules)
    if include_conflicts:
        all_schedules.extend(conflict_schedules)

    stats = {
        'total_valid': len(valid_schedules),
        'total_valid_topon': len(valid_topon_schedules),
        'total_conflicts_found': conflict_total,
        'total_conflicts_returned': len(conflict_schedules),
        'conflict_limit': MAX_CONFLICT_SCHEDULES,
        'conflicts_truncated': conflict_total > len(conflict_schedules)
    }

    return all_schedules, stats
