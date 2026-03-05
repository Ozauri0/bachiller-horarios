import os
import sys
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.routes.massive import MASS_STATE, _run_rebalance_job
from backend.services.data_loader import load_consolidado
from backend.services.massive import load_alumnos_dataframe, process_massive

def test_rebalance():
    print("Loading consolidado...")
    df_base = load_consolidado()
    print("Loading alumnos...")
    alumnos_df = load_alumnos_dataframe()
    test_df = alumnos_df.head(50)  # Use same small subset as before
    
    print("Running initial pass to generate original schedules/overcapacities...")
    results, caps = process_massive(df_base, test_df)
    
    # Manually collect targets the way MASS_STATE would
    MASS_STATE['results'] = results
    MASS_STATE['capacity_report'] = caps
    
    overfull_keys = set()
    for c in caps:
        if c.get('over_capacity') or c.get('remaining', 0) < 0:
            overfull_keys.add((str(c.get('course')), int(c.get('section'))))
            
    target_registros = set()
    for r in results:
        reg = str(r.get('registro', '')).strip()
        status = r.get('status')
        if status in ('sin_horario', 'no_valido'):
            target_registros.add(reg)
            continue

        for s in r.get('sections', []):
            key = (str(s.get('course')), int(s.get('section')) if s.get('section') is not None else None)
            if key in overfull_keys:
                target_registros.add(reg)
                break
                
    print(f"\nCollected {len(target_registros)} targets for rebalancing out of {len(results)} students.")
    
    if not target_registros:
        print("No targets identified. Exiting.")
        return
        
    print("Running rebalance job...")
    start_time = time.time()
    _run_rebalance_job(target_registros, results, df_base)
    end_time = time.time()
    
    print(f"\n--- Rebalance Results ---")
    print(f"Rebalanced in {end_time - start_time:.4f} seconds.")
    for r in MASS_STATE.get('results', []):
        mark = " (TARGETED)" if r.get('registro') in target_registros else ""
        print(f"Student: {r.get('registro')} - Status: {r['status']} - {r['message']}{mark}")

if __name__ == '__main__':
    test_rebalance()
