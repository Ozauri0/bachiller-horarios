from itertools import product
from backend.utils.constants import MAX_CONFLICT_SCHEDULES
from backend.services.data_loader import get_course_sections, get_section_blocks


def blocks_overlap(block1, block2):
    if block1['dia'] != block2['dia']:
        return False

    start1 = block1['hora_ini_min']
    end1 = block1['hora_fin_min']
    start2 = block2['hora_ini_min']
    end2 = block2['hora_fin_min']

    return not (end1 <= start2 or end2 <= start1)


def check_travel_time(block1, block2):
    if block1['dia'] != block2['dia']:
        return True, None

    campus1 = block1['campus_norm']
    campus2 = block2['campus_norm']

    if campus1 == 'VIRTUAL' or campus2 == 'VIRTUAL':
        return True, None
    if campus1 == campus2:
        return True, None

    end1 = block1['hora_fin_min']
    start2 = block2['hora_ini_min']
    end2 = block2['hora_fin_min']
    start1 = block1['hora_ini_min']

    tiempo_requerido = 30
    tipo_topon = 'Topón de campus'
    if campus1 == 'SAN_JUAN_PABLO' or campus2 == 'SAN_JUAN_PABLO':
        tipo_topon = 'Topón de campus (San Juan Pablo II)'

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
        return False, None, None, None

    bach_block = None
    other_block = None

    if block1['curso'] == 'BACH1121':
        bach_block = block1
        other_block = block2
    elif block2['curso'] == 'BACH1121':
        bach_block = block2
        other_block = block1
    else:
        return False, None, None, None

    for _, topon in valid_topones.items():
        if (int(topon['section']) == int(bach_block['seccion']) and
            str(topon['dia']).strip().upper() == bach_block['dia'] and
            str(topon['hora_ini']) == str(bach_block['hora_ini']) and
            str(topon['hora_fin']) == str(bach_block['hora_fin'])):

            tapon_type = topon.get('tapon_type', 'completo')

            if tapon_type == 'completo':
                bach_start = bach_block['hora_ini_min']
                bach_end = bach_block['hora_fin_min']
                other_start = other_block['hora_ini_min']
                other_end = other_block['hora_fin_min']

                if other_start <= bach_start and other_end >= bach_end:
                    return True, 'completo', bach_block, other_block
                return True, 'parcial', bach_block, other_block

            return True, 'parcial', bach_block, other_block

    return False, None, None, None


def calculate_schedule_score(all_blocks):
    if not all_blocks:
        return 0

    days = set(b['dia'] for b in all_blocks)
    days_score = (7 - len(days)) * 100

    dead_time = 0
    for day in days:
        day_blocks = sorted([b for b in all_blocks if b['dia'] == day], key=lambda x: x['hora_ini_min'])
        for i in range(len(day_blocks) - 1):
            end_current = day_blocks[i]['hora_fin_min']
            start_next = day_blocks[i + 1]['hora_ini_min']
            dead_time += max(0, start_next - end_current)

    dead_time_score = -dead_time
    avg_start = sum(b['hora_ini_min'] for b in all_blocks) / len(all_blocks)
    early_score = -avg_start / 10

    return days_score + dead_time_score + early_score


def generate_schedules(df, selected_courses, group_configs=None, valid_topones=None, include_conflicts=True, debug=False):
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

    if debug:
        print(f"DEBUG: group_configs recibido: {group_configs}")
        print(f"DEBUG: valid_topones recibido: {valid_topones}")

    course_group_configs = {}
    for _, config in group_configs.items():
        course_code = config.get('course')
        section = config.get('section')
        groups = config.get('groups', [])

        if debug:
            print(f"DEBUG: Procesando config - curso: {course_code}, sección: {section}, grupos: {groups}")

        if course_code and section is not None and len(groups) >= 2:
            if course_code not in course_group_configs:
                course_group_configs[course_code] = {}
            if int(section) not in course_group_configs[course_code]:
                course_group_configs[course_code][int(section)] = []
            course_group_configs[course_code][int(section)].append([int(g) for g in groups])

    if debug:
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

                if debug:
                    print(f"DEBUG: Verificando curso {course_code}, psec={psec_int}, available_groups={available_groups}")
                    print(f"DEBUG: section_configs keys: {list(section_configs.keys())}")

                if psec_int in section_configs:
                    required_groups_list = section_configs[psec_int]
                    if debug:
                        print(f"DEBUG: Sección {psec_int} TIENE configs, required_groups_list={required_groups_list}")

                    for required_groups in required_groups_list:
                        if all(g in available_groups for g in required_groups):
                            combined_blocks = []
                            for g in required_groups:
                                blocks = get_section_blocks(df, course_code, psec, g)
                                combined_blocks.extend(blocks)

                            if combined_blocks:
                                groups_display = '+'.join(map(str, required_groups))
                                if debug:
                                    print(f"DEBUG: Agregando combinación {course_code} sec {psec_int} grupos {required_groups}")
                                section_options.append({
                                    'course': course_code,
                                    'section': psec,
                                    'group': groups_display,
                                    'is_combined': True,
                                    'blocks': combined_blocks
                                })
                else:
                    if debug:
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
    
    dfs_state = {'conflict_total': 0}

    def build_schedule_entry(combination, all_blocks, conflicts, valid_topones_found, is_valid_flag):
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
            'blocks': all_blocks,
            'score': float(calculate_schedule_score(all_blocks)),
            'has_conflicts': not is_valid_flag,
            'has_valid_topones': len(valid_topones_found) > 0,
            'conflicts': [c['message'] for c in conflicts] if conflicts else [],
            'conflict_types': list(set(c['type'] for c in conflicts)) if conflicts else [],
            'valid_topones': [t['message'] for t in valid_topones_found] if valid_topones_found else [],
            'valid_topon_types': list(set(t['topon_type'] for t in valid_topones_found)) if valid_topones_found else []
        }

    def dfs(course_index, current_combo, current_blocks, current_conflicts, current_valid_topones, bach_topon_tracker):
        if course_index == len(course_sections):
            additional_conflicts = []
            for tracker in bach_topon_tracker.values():
                if len(tracker['others']) > 1:
                    other_descriptions = [
                        f"{other['curso']} ({other['hora_ini']}-{other['hora_fin']})"
                        for other in tracker['others']
                    ]
                    unique_others = ', '.join(dict.fromkeys(other_descriptions))
                    additional_conflicts.append({
                        'type': 'triple_topon',
                        'block': tracker['block'],
                        'message': f"Triple topón: BACH1121 se cruza con {unique_others} el {tracker['block']['dia']} — no hay tiempo para asistir a todas las clases"
                    })
            
            final_conflicts = current_conflicts + additional_conflicts
            is_valid = len(final_conflicts) == 0
            
            if is_valid and len(current_valid_topones) > 0:
                valid_topon_schedules.append(build_schedule_entry(current_combo, current_blocks, final_conflicts, current_valid_topones, True))
            elif is_valid:
                valid_schedules.append(build_schedule_entry(current_combo, current_blocks, final_conflicts, current_valid_topones, True))
            elif include_conflicts:
                dfs_state['conflict_total'] += 1
                if len(conflict_schedules) < MAX_CONFLICT_SCHEDULES:
                    conflict_schedules.append(build_schedule_entry(current_combo, current_blocks, final_conflicts, current_valid_topones, False))
            
            return
            
        if len(current_conflicts) > 0 and include_conflicts and dfs_state['conflict_total'] >= 5000:
            return

        options = course_sections[course_index]
        for opt in options:
            new_blocks = opt['blocks']
            
            new_conflicts = []
            new_valid_topones = []
            new_tracker = {k: {'block': v['block'], 'others': list(v['others'])} for k, v in bach_topon_tracker.items()}
            
            has_overlap = False
            
            blocks_to_check = [(b1, b2) for b1 in new_blocks for b2 in current_blocks]
            for i in range(len(new_blocks)):
                for j in range(i + 1, len(new_blocks)):
                    blocks_to_check.append((new_blocks[i], new_blocks[j]))

            for b1, b2 in blocks_to_check:
                if blocks_overlap(b1, b2):
                    is_valid_tp, topon_type, bach_block, other_block = is_valid_topon(b1, b2, valid_topones)
                    if is_valid_tp:
                        new_valid_topones.append({
                            'type': 'valid_topon',
                            'topon_type': topon_type,
                            'block1': b1, 'block2': b2,
                            'message': f"Topón válido ({topon_type}): {b1['curso']} y {b2['curso']} el {b1['dia']}"
                        })
                        if bach_block:
                            tracker_key = (
                                str(bach_block['curso']), str(bach_block.get('seccion', '')),
                                str(bach_block['dia']), str(bach_block['hora_ini']),
                                str(bach_block['hora_fin']), str(bach_block.get('campus', ''))
                            )
                            tracker = new_tracker.setdefault(tracker_key, {'block': bach_block, 'others': []})
                            tracker['others'].append(other_block)
                    else:
                        has_overlap = True
                        new_conflicts.append({
                            'type': 'overlap',
                            'block1': b1, 'block2': b2,
                            'message': f"Topón horario: {b1['curso']} y {b2['curso']} el {b1['dia']}"
                        })
                else:
                    travel_ok, travel_msg = check_travel_time(b1, b2)
                    if not travel_ok:
                        has_overlap = True
                        new_conflicts.append({
                            'type': 'travel_time',
                            'block1': b1, 'block2': b2,
                            'message': travel_msg
                        })
            
            next_conflicts = current_conflicts + new_conflicts
            next_valid_topones = current_valid_topones + new_valid_topones
            
            if not include_conflicts and len(next_conflicts) > 0:
                continue
                
            dfs(course_index + 1, current_combo + [opt], current_blocks + new_blocks, next_conflicts, next_valid_topones, new_tracker)

    dfs(0, [], [], [], [], {})

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
        'total_conflicts_found': dfs_state['conflict_total'],
        'total_conflicts_returned': len(conflict_schedules),
        'conflict_limit': MAX_CONFLICT_SCHEDULES,
        'conflicts_truncated': dfs_state['conflict_total'] > len(conflict_schedules)
    }

    return all_schedules, stats
