# Generador de Horarios

Frontend moderno (Next.js 15 + TypeScript + Tailwind) sobre backend Flask para generar horarios individuales y masivos.

## Requisitos
- Python 3.10+
- Node.js 18+ y npm
- Dependencias de `requirements.txt`
- Archivos de datos en `data/`:
  - `consolidado.xlsx` (principal, cargado al iniciar)
  - `alumnos.xlsx` (para carga masiva)
  - `cursos_disponibles.xlsx` (cupo por curso/sección)
  - Otros opcionales: `Horarios 2026 reporte.xlsx`, `cruce-horarios.xlsx`

## Arranque rápido
Backend Flask
```bash
pip install -r requirements.txt
python app.py
# expone http://localhost:5000
```

Frontend Next.js
```bash
cd new-front
npm install
npm run dev
# abre http://localhost:3000 (API se reescribe a /api -> backend)
```

### Configurar backend remoto (opcional)
- Por defecto el frontend llama a `/api/*` y el rewrite lo envía a `http://localhost:5000`.
- Para apuntar a otro host/puerto: `set NEXT_PUBLIC_API_BASE=http://mi-backend:5000` (sin slash final) y reinicia `npm run dev`.

## Estructura relevante
- `app.py`: entrada Flask.
- `backend/routes/`: blueprints de API (`/api/*`).
- `backend/services/`: generación de horarios, carga de datos, optimizaciones de caché.
- `backend/utils/constants.py`: rutas y límites.
- `new-front/app/page.tsx`: UI principal con pestañas (Horarios, Config, Datos, Carga masiva).
- `new-front/components/ScheduleGrid.tsx`: grilla de horarios con topones/conflictos.
- `new-front/lib/api.ts`: cliente HTTP con base relativa o `NEXT_PUBLIC_API_BASE`.
- `new-front/next.config.mjs`: rewrite `/api/*` -> backend.
- `data/`: Excel de consolidado, alumnos y cupos.
- `config/config.json`: topones válidos y grupos combinados guardados.

## Uso
1) **Carga Masiva**: sube `alumnos.xlsx`, ejecuta generación, revisa tabla y mensajes.
2) **Horarios**: selecciona cursos y genera horarios; muestra topones y conflictos.
3) **Config**: define grupos obligatorios por sección y topones válidos (persisten en `config/config.json`).
4) **Datos**: importa/exporta/edita `consolidado.xlsx` desde la UI.

## API principal
- `GET /api/courses`
- `POST /api/generate` — body con `courses`, `groupConfigs`, `validTopones`.
- `GET /api/course/<codigo>/sections`
- `GET /api/course/<codigo>/structure`
- `GET /api/bach1121/schedules`
- `GET /api/config/load` / `POST /api/config/save`
- `GET /api/data/all` / `POST /api/data/save`
- `GET /api/data/export` / `POST /api/data/import`

## Optimización reciente (masivo: 20-25 min -> ~20 s)
- Caché por combinación de cursos: reutiliza dataframes filtrados y horarios ya generados para sets de cursos idénticos.
- Caché de horarios generados: evita recomputar combinatorias repetidas durante la pasada masiva.
- Logs verbosos detrás de flag `debug` en `generate_schedules` para reducir E/S.
- Misma lógica y resultados; solo se eliminó trabajo repetido y ruido de consola. Detalles en [docs/performance-optimizations.md](docs/performance-optimizations.md).

## Notas
- El DataFrame se recarga tras importar/guardar datos.
- Mantén los Excel dentro de `data/`.
- Si falta una dependencia: `pip install -r requirements.txt`.
