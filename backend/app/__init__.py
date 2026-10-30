"""
Flask application initialization and configuration
"""
import os
from flask import Flask
from flask_cors import CORS
from flask_restx import Api
from flask_jwt_extended import JWTManager

def create_app(config_name=None):
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Load configuration based on environment
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app.config.from_object(f'app.config.{config_name.capitalize()}Config')
    
    # Initialize extensions
    CORS(app)
    jwt = JWTManager(app)
    
    # Initialize API
    api = Api(
        app,
        version='1.0',
        title='Infrastructure Alert Intelligence Dashboard API',
        description='API for managing infrastructure alerts and analysis',
        doc='/api/docs'
    )
    
    # Register blueprints and namespaces
    from app.api.alerts import api as alerts_ns
    from app.api.infrastructure import api as infrastructure_ns
    from app.api.analysis import api as analysis_ns
    from app.api.predictions import api as predictions_ns
    
    api.add_namespace(alerts_ns, path='/api/alerts')
    api.add_namespace(infrastructure_ns, path='/api/infrastructure')
    api.add_namespace(analysis_ns, path='/api/analysis')
    api.add_namespace(predictions_ns, path='/api/predictions')
    
    @app.get('/api/health')
    def health():
        """Lightweight liveness probe; no database or Kafka dependencies."""
        return {'status': 'ok', 'service': 'infrastructure-alert-dashboard'}, 200

    # Register error handlers
    from app.utils.error_handlers import register_error_handlers
    register_error_handlers(app)
    
    return app
