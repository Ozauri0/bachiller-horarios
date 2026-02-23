import hashlib
import os


def get_file_hash(static_folder, filename):
    """Genera hash MD5 del archivo para cache busting en producción"""
    filepath = os.path.join(static_folder, filename)
    if os.path.exists(filepath):
        try:
            with open(filepath, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()[:8]
        except Exception:
            return 'dev'
    return 'dev'


def register_cache_busting(app):
    """Registra un context processor que inyecta versiones cacheadas de CSS/JS"""
    @app.context_processor
    def inject_file_versions():  # type: ignore
        return {
            'css_v': get_file_hash(app.static_folder, 'styles.css'),
            'js_v': get_file_hash(app.static_folder, 'app.js')
        }

    return app
