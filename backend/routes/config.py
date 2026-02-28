import json
import os
from io import BytesIO
from flask import Blueprint, jsonify, request
from backend.utils.constants import CONFIG_DIR, DATA_DIR
from backend.services.massive import load_alumnos_dataframe

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


@config_bp.route('/config/alumnos', methods=['POST'])
def api_upload_alumnos():
    try:
        upload = request.files.get('file') if 'file' in request.files else None
        if not upload or not upload.filename:
            return jsonify({'success': False, 'error': 'No se recibió un archivo'}), 400

        # Leer a memoria para validar y luego persistir
        content = upload.read()
        try:
            df = load_alumnos_dataframe(BytesIO(content))
        except Exception as e:
            return jsonify({'success': False, 'error': f'Excel inválido: {e}'}), 400

        save_path = DATA_DIR / 'alumnos.xlsx'
        with open(save_path, 'wb') as f:
            f.write(content)

        total = len(df.groupby('REGISTRO')) if 'REGISTRO' in df.columns else len(df)
        return jsonify({'success': True, 'message': 'Alumnos cargados', 'total_alumnos': int(total)})
    except Exception as e:
        print(f"Error subiendo alumnos.xlsx: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
