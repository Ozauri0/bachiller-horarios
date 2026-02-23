from flask import Blueprint, render_template, current_app
from backend.services.data_loader import get_unique_courses

web_bp = Blueprint('web', __name__)


@web_bp.route('/')
def index():
    df = current_app.config['DATAFRAME']
    courses = get_unique_courses(df)
    return render_template('index.html', courses=courses)
