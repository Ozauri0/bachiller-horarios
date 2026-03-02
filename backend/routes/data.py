import pandas as pd
from flask import Blueprint, jsonify, send_file, request, current_app
from backend.services.data_loader import load_consolidado, normalize_consolidado
from backend.utils.constants import DATA_DIR

data_bp = Blueprint('data', __name__)


@data_bp.route('/data/all')
def api_get_all_data():
    try:
        df = current_app.config['DATAFRAME']
        data = df.to_dict('records')

        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None

        return jsonify({
            'success': True,
            'data': data,
            'total': len(data)
        })
    except Exception as e:
        print(f"Error obteniendo datos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@data_bp.route('/data/save', methods=['POST'])
def api_save_data():
    try:
        data = request.json.get('data', [])

        if not data:
            return jsonify({'success': False, 'error': 'No se recibieron datos'}), 400

        new_df = pd.DataFrame(data)
        excel_path = DATA_DIR / 'consolidado.xlsx'
        new_df.to_excel(excel_path, index=False)

        current_app.config['DATAFRAME'] = load_consolidado()

        return jsonify({
            'success': True,
            'message': 'Datos guardados correctamente',
            'total': len(new_df)
        })
    except Exception as e:
        print(f"Error guardando datos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@data_bp.route('/data/export')
def api_export_data():
    try:
        excel_path = DATA_DIR / 'consolidado.xlsx'
        return send_file(
            excel_path,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='consolidado_export.xlsx'
        )
    except Exception as e:
        print(f"Error exportando datos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@data_bp.route('/data/import', methods=['POST'])
def api_import_data():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No se recibió ningún archivo'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'success': False, 'error': 'Nombre de archivo vacío'}), 400

        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({'success': False, 'error': 'El archivo debe ser un Excel (.xlsx o .xls)'}), 400

        raw_df = pd.read_excel(file)
        try:
            normalized_df = normalize_consolidado(raw_df)
        except ValueError as ve:
            return jsonify({'success': False, 'error': str(ve)}), 400

        excel_path = DATA_DIR / 'consolidado.xlsx'
        normalized_df.to_excel(excel_path, index=False)
        current_app.config['DATAFRAME'] = load_consolidado()

        return jsonify({
            'success': True,
            'message': 'Archivo importado correctamente',
            'total': len(normalized_df)
        })
    except Exception as e:
        print(f"Error importando datos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
