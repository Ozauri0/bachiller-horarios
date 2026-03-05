from pathlib import Path

# Ruta base del proyecto (carpeta raíz del repo)
BASE_DIR = Path(__file__).resolve().parents[2]

# Directorios comunes
DATA_DIR = BASE_DIR / 'data'
CONFIG_DIR = BASE_DIR / 'config'
STATIC_DIR = BASE_DIR / 'static'
TEMPLATES_DIR = BASE_DIR / 'templates'

# Límites de negocio
MAX_CONFLICT_SCHEDULES = 10000
