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


def schedule_capacity_margin(schedule, remaining_caps):
    margins = []
    for sec in schedule.get('sections', []):
        try:
            key = (str(sec['course']), int(sec['section']))
        except Exception:
            continue
        margins.append(remaining_caps.get(key, INF_CAP))
    return min(margins) if margins else INF_CAP

def schedule_capacity_ok(schedule, remaining_caps):
    return schedule_capacity_margin(schedule, remaining_caps) > 0


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

    schedule_cache = {}
    student_df_cache = {}
    course_meta_cache = {}

    grouped = alumnos_df.groupby('REGISTRO')
    total = len(grouped)
    
    preprocessed_students = []

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

        if course_codes_key in student_df_cache:
            student_df, missing = student_df_cache[course_codes_key]
        else:
            student_df, missing = build_student_df(base_df, course_codes)
            student_df_cache[course_codes_key] = (student_df, missing)
            
        if missing:
            _emit_progress(progress_cb, idx, total, nombre_completo or registro_val, registro_val, 'recopilando_opciones', [], [])
            preprocessed_students.append({
                'registro_val': registro_val, 'rut': rut, 'rut_num': rut_num, 'dv_val': dv_val, 
                'nombre_completo': nombre_completo, 'nombre': nombre, 'ap_pat': ap_pat, 'ap_mat': ap_mat,
                'course_codes': course_codes, 'course_meta': course_meta,
                'missing': missing, 'valid_combinations_count': 0, 'schedules': []
            })
            continue

        if course_codes_key in schedule_cache:
            schedules, _stats = schedule_cache[course_codes_key]
        else:
            schedules, _stats = generate_schedules(
                student_df,
                course_codes,
                group_configs=group_configs,
                valid_topones=valid_topones,
                include_conflicts=True,
            )
            schedule_cache[course_codes_key] = (schedules, _stats)

        valid_combinations_count = sum(1 for s in schedules if not s.get('has_conflicts'))
        
        preprocessed_students.append({
            'registro_val': registro_val, 'rut': rut, 'rut_num': rut_num, 'dv_val': dv_val, 
            'nombre_completo': nombre_completo, 'nombre': nombre, 'ap_pat': ap_pat, 'ap_mat': ap_mat,
            'course_codes': course_codes, 'course_meta': course_meta,
            'missing': [], 'valid_combinations_count': valid_combinations_count, 'schedules': schedules
        })
        _emit_progress(progress_cb, idx, total, nombre_completo or registro_val, registro_val, 'recopilando_opciones', [], [])

    # Sort students: Missing first (though we skip them), then by fewest valid schedules (Most Constrained First constraint resolution)
    preprocessed_students.sort(key=lambda x: (x['missing'] != [], x['valid_combinations_count']))
    
    sin_horario_results = []
    student_entries = []

    for idx, sdata in enumerate(preprocessed_students):
        if sdata['missing']:
            sin_horario_results.append({
                'registro': sdata['registro_val'],
                'rut': sdata['rut'],
                'rut_num': sdata['rut_num'],
                'dv': sdata['dv_val'],
                'nombre': sdata['nombre_completo'],
                'nombre_pila': sdata['nombre'],
                'apellido_paterno': sdata['ap_pat'],
                'apellido_materno': sdata['ap_mat'],
                'cursos': sdata['course_codes'],
                'status': 'sin_horario',
                'message': 'Faltan bloques en consolidado: ' + ', '.join(sdata['missing']),
                'sections': []
            })
            _emit_progress(progress_cb, idx, total, sdata['nombre_completo'], sdata['registro_val'], 'asignando_cupos', sin_horario_results, student_entries)
            continue
            
        schedules = sdata['schedules']
        candidate_schedules = schedules if schedules else []

        chosen = None
        used_topon = None

        # Prioridad 1: Horario totalmente válido sin sobrecupo
        for sched in candidate_schedules:
            if not sched.get('has_conflicts') and schedule_capacity_ok(sched, remaining_caps):
                chosen = sched
                used_topon = sched.get('has_valid_topones')
                break

        # Prioridad 2: Horario totalmente válido pero con menor daño a los cupos (Least Constraining)
        if chosen is None:
            best_margin = -INF_CAP
            for sched in candidate_schedules:
                if not sched.get('has_conflicts'):
                    margin = schedule_capacity_margin(sched, remaining_caps)
                    if margin > best_margin:
                        best_margin = margin
                        chosen = sched
                        used_topon = sched.get('has_valid_topones')
        
        # Prioridad 3: Horarios inválidos (Fallback final)
        if chosen is None:
            chosen, used_topon = pick_best_schedule(schedules)
            
        if not chosen and schedules:
            chosen = schedules[0]
            used_topon = chosen.get('has_valid_topones')
            
        if not chosen:
            sin_horario_results.append({
                'registro': sdata['registro_val'],
                'rut': sdata['rut'],
                'rut_num': sdata['rut_num'],
                'dv': sdata['dv_val'],
                'nombre': sdata['nombre_completo'],
                'nombre_pila': sdata['nombre'],
                'apellido_paterno': sdata['ap_pat'],
                'apellido_materno': sdata['ap_mat'],
                'cursos': sdata['course_codes'],
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
            _emit_progress(progress_cb, idx, total, sdata['nombre_completo'], sdata['registro_val'], 'asignando_cupos', sin_horario_results, student_entries)
            continue

        courses_detail = []
        for sec in chosen.get('sections', []):
            meta = sdata['course_meta'].get(sec['course'], {})
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
            'registro': sdata['registro_val'],
            'rut': sdata['rut'],
            'rut_num': sdata['rut_num'],
            'dv': sdata['dv_val'],
            'nombre': sdata['nombre_completo'],
            'nombre_pila': sdata['nombre'],
            'apellido_paterno': sdata['ap_pat'],
            'apellido_materno': sdata['ap_mat'],
            'cursos': sdata['course_codes'],
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
        _emit_progress(progress_cb, idx, total, sdata['nombre_completo'], sdata['registro_val'], 'asignando_cupos', sin_horario_results, student_entries)

    # Multi-pass Ajuste Agresivo de sobrecupos
    _emit_progress(progress_cb, total, total, 'Resolviendo colisiones de cupos globales', '', 'ajustando_multi', sin_horario_results, student_entries)

    max_passes = 3
    for pass_number in range(max_passes):
        overfull_keys = {k: v for k, v in remaining_caps.items() if v < 0}
        if not overfull_keys:
            break
            
        overfull_sections = {k for k, v in remaining_caps.items() if v < 0}
        moved_in_pass = 0
        
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

            apply_capacity(old_sched, remaining_caps, 1)

            swapped = False
            best_cand = None
            best_cand_margin = -INF_CAP
            
            # Busco cual candidato nuevo provoca el menor daño (menos sobrecupo total en mi combinación)
            for cand in entry.get('candidates', []):
                if cand.get('sections', []) == old_sched.get('sections', []):
                    continue
                if cand.get('has_conflicts'):
                    continue
                if cand.get('valid_topones') and not cand.get('has_valid_topones'):
                    continue

                # El margen de un candidato es el peor cupo de sus secciones
                cand_margin = schedule_capacity_margin(cand, remaining_caps)
                
                if cand_margin > best_cand_margin:
                    best_cand_margin = cand_margin
                    best_cand = cand

            old_margin = schedule_capacity_margin(old_sched, remaining_caps)
            
            # Solo hago swap si el nuevo best_cand mejora objetivamente el margen que teníamos
            # (Ej. Estábamos en una sección muy sobrevendida de margen -5, vamos a una de margen -1 o >0)
            if best_cand and best_cand_margin > old_margin:
                apply_capacity(best_cand, remaining_caps, -1)
                entry['sections'] = best_cand.get('sections', [])
                entry['blocks'] = best_cand.get('blocks', [])
                entry['has_conflicts'] = best_cand.get('has_conflicts', False)
                entry['conflicts'] = best_cand.get('conflicts', [])
                entry['valid_topones'] = best_cand.get('valid_topones', [])
                entry['valid_topon_types'] = best_cand.get('valid_topon_types', [])
                entry['has_valid_topones'] = best_cand.get('has_valid_topones', False)
                
                over_capacity_now = best_cand_margin < 0
                entry['over_capacity'] = over_capacity_now

                if entry['has_conflicts']:
                    entry['status'] = 'no_valido'
                    entry['message'] = 'Horario reajustado con conflictos por cupos llenos'
                else:
                    entry['status'] = 'con_horario'
                    entry['message'] = 'Horario reajustado por cupos (Mejorado)' if over_capacity_now else 'Horario reajustado (Espacio Perfecto)'

                swapped = True
                moved_in_pass += 1
            else:
                apply_capacity(old_sched, remaining_caps, -1)
                
        if moved_in_pass == 0:
            break

    _emit_progress(progress_cb, total, total, 'Ajuste completado', '', 'completado', sin_horario_results, student_entries)

    results = list(sin_horario_results)
    for entry in student_entries:
        entry.pop('candidates', None)
        results.append(entry)

    capacity_report = []
    for (code, section), cap in capacities.items():
        if cap is None:
            continue
        remaining = remaining_caps.get((code, section), INF_CAP)
        if cap >= INF_CAP:
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
