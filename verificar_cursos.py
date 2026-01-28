import pandas as pd

print("=" * 60)
print("VERIFICACIÓN DE CURSOS EN CRUCE-HORARIOS")
print("=" * 60)

# Cargar cruce-horarios
cruce = pd.read_excel('cruce-horarios.xlsx')
print(f"\nColumnas de cruce-horarios: {cruce.columns.tolist()}")
print(f"Total filas en cruce-horarios: {len(cruce)}")

# Limpiar datos
cruce['asig_codigo'] = cruce['asig_codigo'].astype(str).str.strip()
cruce['psec_codigo'] = cruce['psec_codigo'].fillna(1).astype(int)
cruce['uaca_nombre'] = cruce['uaca_nombre'].astype(str).str.strip()

print("\n" + "=" * 60)
print("VALORES ÚNICOS DE uaca_nombre:")
print("=" * 60)
for val in cruce['uaca_nombre'].unique():
    count = len(cruce[cruce['uaca_nombre'] == val])
    print(f"  - '{val}': {count} filas")

print("\n" + "=" * 60)
print("BUSCANDO CURSOS ESPECÍFICOS EN CRUCE-HORARIOS")
print("=" * 60)

cursos_buscar = ['QUI1150', 'ING1102', 'BACH1127', 'BACH1125']

for codigo in cursos_buscar:
    print(f"\n>>> Buscando {codigo}:")
    encontrados = cruce[cruce['asig_codigo'] == codigo]
    if len(encontrados) > 0:
        print(f"    Encontrado! {len(encontrados)} filas")
        for _, row in encontrados.iterrows():
            print(f"    - Sección {row['psec_codigo']}, Carrera: {row['uaca_nombre'][:50]}...")
    else:
        print(f"    NO encontrado en cruce-horarios")

print("\n" + "=" * 60)
print("CURSOS PARA BACHILLER (filtrado por uaca_nombre)")
print("=" * 60)

# Filtrar por BACHILLER
df_bach = cruce[cruce['uaca_nombre'].str.contains('BACHILLER', case=False, na=False)]
print(f"\nFilas con 'BACHILLER' en uaca_nombre: {len(df_bach)}")
print(f"Cursos únicos: {df_bach['asig_codigo'].nunique()}")
print(f"\nCursos encontrados:")
for codigo in sorted(df_bach['asig_codigo'].unique()):
    secciones = sorted(df_bach[df_bach['asig_codigo'] == codigo]['psec_codigo'].unique())
    print(f"  - {codigo}: secciones {secciones}")

print("\n" + "=" * 60)
print("VERIFICANDO EN HORARIOS 2026")
print("=" * 60)

# Cargar horarios
df_horarios = pd.read_excel('HORARIOS 2026.xlsx', usecols=range(20))
df_horarios.columns = ['sare_codigo', 'sare_anho', 'sare_semestre', 'uaca_codigo', 'uaca_nombre', 
              'sree_codigo', 'sree_nombre', 'sacu_codigo', 'asig_codigo', 'asig_nombre', 
              'psec_codigo', 'pgru_codigo', 'hora_fin', 'hora_ini', 'dia', 'campus', 
              'tipo_sala', 'ambiente', 'comentario', 'extra']
df_horarios = df_horarios.dropna(subset=['asig_codigo'])
df_horarios['asig_codigo'] = df_horarios['asig_codigo'].astype(str).str.strip()
df_horarios['psec_codigo'] = df_horarios['psec_codigo'].fillna(1).astype(int)

for codigo in cursos_buscar:
    print(f"\n>>> {codigo} en HORARIOS 2026:")
    encontrados = df_horarios[df_horarios['asig_codigo'] == codigo]
    if len(encontrados) > 0:
        secciones = sorted(encontrados['psec_codigo'].unique())
        print(f"    Encontrado! Secciones: {secciones}")
    else:
        print(f"    NO encontrado")

print("\n" + "=" * 60)
print("CONCLUSIÓN")
print("=" * 60)
print("""
El problema es que el filtro actual busca cursos en cruce-horarios
que tengan uaca_nombre = 'CARRERA BACHILLER CIENCIAS Y HUMANIDADES'.

Si QUI1150 e ING1102 no están en cruce-horarios con esa carrera,
no aparecerán en el filtrado aunque existan en HORARIOS 2026.

SOLUCIÓN: Los electivos deben incluir TODOS los cursos de HORARIOS 2026
que NO empiecen con 'BACH', con TODAS sus secciones.
""")
