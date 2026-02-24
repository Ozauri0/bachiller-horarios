import json
from backend.utils.constants import CONFIG_DIR


def load_saved_config():
    config_path = CONFIG_DIR / 'config.json'
    if not config_path.exists():
        return {}, {}
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('groupConfigs', {}), data.get('toponesConfigs', {})
    except Exception:
        return {}, {}
