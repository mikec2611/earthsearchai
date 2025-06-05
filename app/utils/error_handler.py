import logging
import traceback
from functools import wraps
from typing import Callable, Any
from flask import jsonify, request


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def handle_api_errors(f: Callable) -> Callable:
    """Decorator to handle API errors consistently."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            logger.warning(f"ValueError in {f.__name__}: {str(e)}")
            return jsonify({'error': f'Invalid input: {str(e)}'}), 400
        except KeyError as e:
            logger.warning(f"KeyError in {f.__name__}: {str(e)}")
            return jsonify({'error': f'Missing required field: {str(e)}'}), 400
        except Exception as e:
            logger.error(f"Unexpected error in {f.__name__}: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({'error': 'Internal server error'}), 500
    
    return decorated_function


def log_api_call(f: Callable) -> Callable:
    """Decorator to log API calls."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        logger.info(f"API call: {request.method} {request.path}")
        if request.get_json():
            logger.debug(f"Request data: {request.get_json()}")
        
        result = f(*args, **kwargs)
        
        logger.info(f"API call completed: {request.method} {request.path}")
        return result
    
    return decorated_function


class APIError(Exception):
    """Custom API error class."""
    
    def __init__(self, message: str, status_code: int = 500, payload: dict = None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload
    
    def to_dict(self) -> dict:
        """Convert error to dictionary for JSON response."""
        result = {'error': self.message}
        if self.payload:
            result.update(self.payload)
        return result


def safe_api_call(func: Callable, default_return: Any = None, error_message: str = None) -> Any:
    """
    Safely execute an API call with error handling.
    
    Args:
        func: Function to execute
        default_return: Default value to return on error
        error_message: Custom error message
        
    Returns:
        Function result or default_return on error
    """
    try:
        return func()
    except Exception as e:
        message = error_message or f"Error in {func.__name__}: {str(e)}"
        logger.error(message)
        logger.error(traceback.format_exc())
        return default_return 