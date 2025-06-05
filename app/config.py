import os
from typing import Dict, Any


class Config:
    """Base configuration class."""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # API Keys
    MAPBOX_TOKEN = os.environ.get('MAPBOX_TOKEN')
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    GOOGLE_API_KEY = os.environ.get('G00GL3_API_K3Y')
    OPENWEATHER_API_KEY = os.environ.get('OPEN_WEATHER_API_KEY')
    
    # Application settings
    PROMPT_XML_PATH = "prompts.xml"
    DEFAULT_PORT = 8000
    
    # AI Settings
    AI_MODEL = "gpt-4o-mini"
    AI_TEMPERATURE = 0.7
    AI_MAX_TOKENS = 800
    
    # Request settings
    REQUEST_TIMEOUT = 10
    MAX_RETRIES = 3
    
    @classmethod
    def validate_required_env_vars(cls) -> Dict[str, Any]:
        """Validate that required environment variables are set."""
        missing_vars = []
        warnings = []
        
        required_vars = {
            'MAPBOX_TOKEN': cls.MAPBOX_TOKEN,
            'OPENAI_API_KEY': cls.OPENAI_API_KEY,
            'G00GL3_API_K3Y': cls.GOOGLE_API_KEY,
        }
        
        optional_vars = {
            'OPEN_WEATHER_API_KEY': cls.OPENWEATHER_API_KEY,
        }
        
        for var_name, var_value in required_vars.items():
            if not var_value:
                missing_vars.append(var_name)
        
        for var_name, var_value in optional_vars.items():
            if not var_value:
                warnings.append(f"{var_name} not set - some features may not work")
        
        return {
            'missing_required': missing_vars,
            'warnings': warnings,
            'is_valid': len(missing_vars) == 0
        }


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False


class TestingConfig(Config):
    """Testing configuration."""
    DEBUG = True
    TESTING = True


# Configuration mapping
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config(config_name: str = None) -> Config:
    """Get configuration by name."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    
    return config_by_name.get(config_name, DevelopmentConfig) 