"""
Script para verificar el filtrado de cursos/secciones entre cruce-horarios.xlsx y HORARIOS 2026.xlsx
SOLO cursos de BACHILLER
"""
import pandas as pd

print("Cargando cruce-horarios.xlsx...")
cruce = pd.read_excel('cruce-horarios.xlsx')
cruce['asig_codigo'] = cruce['asig_codigo'].astype(str).str.strip()
cruce['psec_codigo'] = cruce['psec_codigo'].fillna(1).astype(int)
cruce['uaca_nombre'] = cruce['uaca_nombre'].astype(str).str.strip()

# FILTRAR SOLO BACHILLER
cruce_bachiller = cruce[cruce['uaca_nombre'] == 'CARRERA BACHILLER CIENCIAS Y HUMANIDADES']
print(f"Filas totales en cruce: {len(cruce)}")
print(f"Filas de BACHILLER: {len(cruce_bachiller)}")

# Crear set de (curso, seccion) disponibles SOLO para bachiller
available = set()
for _, row in cruce_bachiller.iterrows():
    available.add((row['asig_codigo'], int(row['psec_codigo'])))

print(f"Total pares (curso, seccion) para BACHILLER: {len(available)}")

print("\nCargando HORARIOS 2026.xlsx...")
df = pd.read_excel('HORARIOS 2026.xlsx', usecols=range(20))
df.columns = ['sare_codigo', 'sare_anho', 'sare_semestre', 'uaca_codigo', 'uaca_nombre', 
              'sree_codigo', 'sree_nombre', 'sacu_codigo', 'asig_codigo', 'asig_nombre', 
              'psec_codigo', 'pgru_codigo', 'hora_fin', 'hora_ini', 'dia', 'campus', 
              'tipo_sala', 'ambiente', 'comentario', 'extra']
df = df.dropna(subset=['asig_codigo'])
df['asig_codigo'] = df['asig_codigo'].astype(str).str.strip()
df['psec_codigo'] = df['psec_codigo'].fillna(1).astype(int)

print(f"Total filas en HORARIOS 2026: {len(df)}")

# Verificar DERE1102 específicamente
print("\n" + "="*50)
print("VERIFICACIÓN DE DERE1102:")
print("="*50)
dere_cruce = [s for c, s in available if c == 'DERE1102']
print(f"Secciones en cruce-horarios: {sorted(dere_cruce)}")

dere_horarios = df[df['asig_codigo'] == 'DERE1102']['psec_codigo'].unique()
print(f"Secciones en HORARIOS 2026: {sorted(dere_horarios)}")

# Mostrar cursos donde HORARIOS tiene más secciones que cruce
print("\n" + "="*50)
print("CURSOS CON DIFERENCIA DE SECCIONES:")
print("(HORARIOS tiene secciones que NO están en cruce)")
print("="*50)

diferencias = []
for codigo in df['asig_codigo'].unique():
    secciones_horarios = set(df[df['asig_codigo'] == codigo]['psec_codigo'].unique())
    secciones_cruce = set(s for c, s in available if c == codigo)
    
    if secciones_cruce:  # Solo si el curso está en cruce
        extras = secciones_horarios - secciones_cruce  # Secciones en horarios que NO están en cruce
        if extras:
            diferencias.append({
                'codigo': codigo,
                'horarios': sorted(secciones_horarios),
                'cruce': sorted(secciones_cruce),
                'extras': sorted(extras)
            })

print(f"\nEncontrados {len(diferencias)} cursos con diferencias:\n")
for d in diferencias[:20]:  # Mostrar primeros 20
    print(f"{d['codigo']}:")
    print(f"  HORARIOS: {d['horarios']}")
    print(f"  CRUCE:    {d['cruce']}")
    print(f"  EXTRAS (no usar): {d['extras']}")
    print()

# Verificar el filtrado actual
print("="*50)
print("SIMULANDO FILTRADO:")
print("="*50)
filtered = []
for _, row in df.iterrows():
    key = (row['asig_codigo'], int(row['psec_codigo']))
    if key in available:
        filtered.append(row)

df_filtered = pd.DataFrame(filtered)
print(f"Filas después del filtrado: {len(df_filtered)}")
print(f"Cursos únicos después del filtrado: {df_filtered['asig_codigo'].nunique()}")

# Verificar DERE1102 después del filtrado
dere_filtered = df_filtered[df_filtered['asig_codigo'] == 'DERE1102']['psec_codigo'].unique()
print(f"\nDERE1102 después del filtrado: {sorted(dere_filtered)}")
