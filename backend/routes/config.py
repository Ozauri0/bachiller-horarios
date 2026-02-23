import json
import os
from flask import Blueprint, jsonify
from backend.utils.constants import CONFIG_DIR

config_bp = Blueprint('config', __name__)


@config_bp.route('/config/load', methods=['GET'])
def api_load_config():
    config_path = CONFIG_DIR / 'config.json'

    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            return jsonify(config)
        except Exception as e:
            print(f"Error cargando config: {str(e)}")
            return jsonify({'groupConfigs': {}, 'toponesConfigs': {}})
    return jsonify({'groupConfigs': {}, 'toponesConfigs': {}})


@config_bp.route('/config/save', methods=['POST'])
def api_save_config():
    from flask import request  # Import local para mantener dependencias mínimas
    try:
        data = request.json
        config_path = CONFIG_DIR / 'config.json'

        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return jsonify({'success': True, 'message': 'Configuración guardada correctamente'})
    except Exception as e:
        print(f"Error guardando config: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
