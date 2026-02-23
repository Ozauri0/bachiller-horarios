# App de generación de horarios

## Requisitos
- Python 3.10+ (usa el `venv` incluido si existe)
- Dependencias de `requirements.txt`
- Archivos de datos en `data/`:
  - `consolidado.xlsx` (principal, cargado al iniciar)
  - `Horarios 2026 reporte.xlsx` (opcional para scripts)
  - `cruce-horarios.xlsx` (opcional para scripts de verificación)

## Instalación y ejecución
1) Activar el entorno virtual (si existe):
   - Linux/macOS: `source venv/bin/activate`
2) Instalar dependencias: `pip install -r requirements.txt`
3) Ejecutar el servidor: `python app.py`
4) Abrir en el navegador: `http://localhost:5000`

## Estructura
- `app.py`: punto de entrada; instancia la app Flask desde `backend/`.
- `backend/`: lógica del backend.
  - `routes/`: blueprints (`/api/*` y ruta `/`).
  - `services/`: generación de horarios y carga de datos.
  - `utils/`: constantes y cache busting.
- `data/`: archivos Excel.
- `config/config.json`: configuración guardada (topones válidos y grupos combinados).
- `static/`, `templates/`: frontend.
- `scripts/`: utilidades de verificación sobre los Excel.

## Uso en la UI
1) Selecciona cursos y pulsa **Generar Horarios**.
2) Revisa resultados; verás avisos de topones válidos/ inválidos y conflictos de campus.
3) Pestaña Configuración:
   - Define combinaciones de grupos obligatorios por curso/sección.
   - Define topones válidos para BACH1121 (completos o parciales).
   - Guarda/carga configuración (persiste en `config/config.json`).
4) Pestaña Datos: exporta/importa/edita `consolidado.xlsx`.

## API principal
- `GET /` — página principal.
- `GET /api/courses` — lista de cursos.
- `POST /api/generate` — genera horarios. Body JSON:
  ```json
  {
    "courses": ["COD1", "COD2"],
    "groupConfigs": {"CURSO_SEC": {"course": "CURSO", "section": 1, "groups": [0,1]}},
    "validTopones": {"id": {"section": 1, "group": 0, "dia": "Lunes", "hora_ini": "08:00", "hora_fin": "10:00", "tapon_type": "completo"}}
  }
  ```
- `GET /api/course/<codigo>/sections`
- `GET /api/course/<codigo>/structure`
- `GET /api/bach1121/schedules`
- `GET /api/config/load` / `POST /api/config/save`
- `GET /api/data/all` / `POST /api/data/save`
- `GET /api/data/export` / `POST /api/data/import`

## Notas
- El DataFrame se recarga tras importar/guardar datos.
- Si falta Flask u otra lib: `pip install -r requirements.txt`.
- Mantén los Excel dentro de `data/` para rutas coherentes.
