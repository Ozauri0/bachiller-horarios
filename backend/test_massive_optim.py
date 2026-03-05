import os
import sys
import time
import pandas as pd

# Add root project dir to path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.services.data_loader import load_consolidado
from backend.services.massive import load_alumnos_dataframe, process_massive
from backend.utils.constants import DATA_DIR
import pandas as pd

def test_performance():
    print("Loading consolidado...")
    df_base = load_consolidado()
    print("Loading alumnos...")
    alumnos_df = load_alumnos_dataframe()
    
    # We will test with a chunk of the dataframe, e.g., the first 50 rows (which may correspond to ~8-10 students)
    test_df = alumnos_df.head(50)
    student_count = test_df['REGISTRO'].nunique()
    print(f"Testing with {student_count} unique students...")
    
    start_time = time.time()
    results, caps = process_massive(df_base, test_df)
    end_time = time.time()
    
    print(f"\n--- Results ---")
    print(f"Processed {len(results)} student records in {end_time - start_time:.4f} seconds.")
    for r in results:
        print(f"Student: {r.get('rut', r.get('registro'))} - Status: {r['status']} - {r['message']}")

if __name__ == '__main__':
    test_performance()
