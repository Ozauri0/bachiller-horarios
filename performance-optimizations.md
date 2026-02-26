# Performance Optimizations

## Massive schedule generation caches

La carga masiva evita recomputar trabajo repetitivo usando tres cachés principales, todas en memoria del proceso Flask durante la ejecución de un job:

- **schedule_cache** (`dict[tuple[str, ...]] -> list[Schedule]`): clave es el conjunto ordenado de cursos solicitados por un alumno. Si otro alumno pide la misma combinación, se reutiliza el resultado de `generate_schedules` (búsqueda combinatoria completa) en lugar de recalcularlo.
- **student_df_cache** (`dict[tuple[str, ...]] -> (DataFrame, list[str])`): para cada combinación de cursos, se almacena el DataFrame filtrado con los bloques relevantes y la lista de faltantes. Así se evita repetir filtros de pandas por cada alumno con la misma combinación.
- **course_meta_cache** (`dict[tuple[str, ...]] -> dict[str, dict]]`): guarda metadatos (nombre, semestre, plan) por curso para la combinación; evita recomputar `collect_course_meta` por alumno.

### Efecto en el flujo
1) Se agrupan los alumnos por `REGISTRO` y se extrae el conjunto de cursos (clave de caché).
2) Si la combinación ya existe en cache: se reutilizan DataFrame filtrado, metadatos y horarios generados.
3) Solo se ejecuta `generate_schedules` una vez por combinación única de cursos, sin perder lógica de cupos, topones ni conflictos.

### Beneficios
- Reduce drásticamente llamadas a `generate_schedules` (que es la parte más costosa) cuando muchos alumnos comparten la misma canasta de cursos.
- Disminuye el costo de filtrado de pandas por combinación repetida.
- Menos GC y CPU al no reconstruir metadatos por alumno.

### Consideraciones
- El cache vive por proceso y por job; si el dataset es enorme y las combinaciones son muy variadas (poca repetición), el impacto se reduce.
- No se cachean resultados entre ejecuciones: cada job limpia y recalcula sus cachés.
- Memoria: las estructuras son relativamente pequeñas comparadas al DataFrame base; si se creciera mucho, se podría añadir un límite LRU por combinaciones.
