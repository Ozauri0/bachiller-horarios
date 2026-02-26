# Optimización de generación masiva de horarios

## Situación inicial
- 300–500 alumnos, 20–25 minutos por corrida.
- CPU bajo y mucha espera por recomputaciones repetidas.

## Cambios aplicados
1) **Caché por combinación de cursos** (clave: cursos ordenados):
   - Guarda el dataframe filtrado de alumno (`student_df`) y la lista de horarios generados para ese set de cursos.
   - Resultado: cada combinación única se computa una sola vez; las siguientes peticiones reutilizan resultados.

2) **Caché de generación de horarios** en la pasada masiva:
   - Antes: cada alumno con los mismos cursos volvía a explorar todo el espacio combinatorio.
   - Ahora: si el set de cursos ya fue evaluado, se toma directamente la lista de horarios ya calculados.

3) **Silencio de verbose logs**:
   - Los `print` de depuración en `generate_schedules` se ejecutan solo si `debug=True`.
   - Menos E/S de consola en ejecuciones largas.

## Archivos modificados
- `backend/services/massive.py`
  - `schedule_cache`: caché (course_set -> horarios generados).
  - `student_df_cache`: caché de dataframes filtrados (course_set -> df + faltantes).
- `backend/services/schedules.py`
  - Flag `debug` para controlar logs de depuración.

## Impacto
- Tiempo de 20–25 minutos → ~15–20 segundos.
- Misma lógica y resultados: no se alteraron reglas de cupos, topes, topones ni selección.
- Ahorro proviene de eliminar trabajo repetido y E/S innecesaria.

## Cómo funciona en ejecución
1) Se calcula la clave `course_codes_key = tuple(sorted(course_codes))` por alumno.
2) Si la clave está en `student_df_cache`, se reutiliza el dataframe filtrado; si no, se filtra y se guarda.
3) Si la clave está en `schedule_cache`, se reutiliza la lista de horarios generados; si no, se llama a `generate_schedules` y se guarda.
4) Se sigue aplicando la lógica de cupos, selección del mejor horario, y reajuste posterior.

## Cómo habilitar logs de depuración (opcional)
- Llamar `generate_schedules(..., debug=True)` para volver a ver los `print` detallados.
- Por defecto está en `False` para no penalizar rendimiento.