from flask import Flask
from backend.utils.constants import STATIC_DIR, TEMPLATES_DIR
from backend.utils.cache_busting import register_cache_busting
from backend.services.data_loader import load_consolidado
from backend.routes.web import web_bp
from backend.routes.schedules import schedules_bp
from backend.routes.config import config_bp
from backend.routes.data import data_bp


def create_app():
    app = Flask(
        __name__,
        static_folder=str(STATIC_DIR),
        template_folder=str(TEMPLATES_DIR)
    )

    register_cache_busting(app)

    app.config['DATAFRAME'] = load_consolidado()

    app.register_blueprint(web_bp)
    app.register_blueprint(schedules_bp, url_prefix='/api')
    app.register_blueprint(config_bp, url_prefix='/api')
    app.register_blueprint(data_bp, url_prefix='/api')

    return app
