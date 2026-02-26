from flask import Blueprint, render_template, current_app, request
from backend.services.data_loader import get_unique_courses

web_bp = Blueprint('web', __name__)


@web_bp.route('/', methods=['GET', 'POST'])
def index():
    # Algunas herramientas externas envían POST / como healthcheck; respondemos 204 para evitar ruido en logs.
    if request.method == 'POST':
        return ('', 204)

    df = current_app.config['DATAFRAME']
    courses = get_unique_courses(df)
    return render_template('index.html', courses=courses)
