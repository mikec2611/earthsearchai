from flask import Flask
from dotenv import load_dotenv
from app.config import get_config

def create_app(config_name: str = None):
    """Application factory pattern."""
    load_dotenv()
    
    # Configure Flask to look for templates and static files in the root directory
    import os
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app = Flask(__name__, 
                template_folder=os.path.join(root_dir, 'templates'),
                static_folder=os.path.join(root_dir, 'static'))
    
    # Load configuration
    config = get_config(config_name)
    app.config.from_object(config)
    
    # Validate environment variables
    validation_result = config.validate_required_env_vars()
    if not validation_result['is_valid']:
        missing_vars = validation_result['missing_required']
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    # Log warnings for optional variables
    for warning in validation_result['warnings']:
        print(f"Warning: {warning}")
    
    # Register blueprints
    from app.routes import main_bp
    app.register_blueprint(main_bp)
    
    return app 