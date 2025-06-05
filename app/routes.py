import os
from flask import Blueprint, render_template, jsonify, request
from app.services.location_service import LocationService
from app.services.ai_service import AIService
from app.services.video_service import VideoService

main_bp = Blueprint('main', __name__)

# Initialize services
location_service = LocationService()
ai_service = AIService()
video_service = VideoService()

# Configuration
MAPBOX_TOKEN = os.environ.get('MAPBOX_TOKEN')
PROMPT_XML_PATH = "prompts.xml"


@main_bp.route('/')
def home():
    """Home page with the interactive globe."""
    return render_template('main.html', mapbox_access_token=MAPBOX_TOKEN)


@main_bp.route('/get-weather-key')
def get_weather_key():
    """API endpoint to get weather API key."""
    api_key = os.getenv("OPEN_WEATHER_API_KEY")
    if api_key:
        return jsonify({'apiKey': api_key})
    else:
        return jsonify({'error': 'OpenWeatherMap API key not found in environment'}), 404


@main_bp.route('/coordinates', methods=['POST'])
def coordinates():
    """Process coordinates and return location information."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Extract and validate coordinates
        lat = data.get('lat')
        lng = data.get('lng')
        
        if lat is None or lng is None:
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        
        # Round coordinates
        lat = round(float(lat), 3)
        lng = round(float(lng), 3)
        coordinates = f"{lat}, {lng}"
        
        # Get location name
        loc_result, loc_name = location_service.get_location_name(lat, lng)
        nearby_features = data.get('nearby_features', [])
        
        # Process based on prompt type
        prompt_type = data.get('prompt_type', 'general')
        
        if prompt_type == 'general':
            return _process_general_prompt(loc_result, loc_name, coordinates, nearby_features)
        elif prompt_type == 'detail':
            # Placeholder for detailed prompt processing
            return jsonify({
                'main_content': 'Detailed view not implemented yet',
                'video_content': 'test',
                'loc_name': loc_name
            })
        else:
            return jsonify({'error': 'Invalid prompt type'}), 400
            
    except ValueError as e:
        return jsonify({'error': f'Invalid data format: {str(e)}'}), 400
    except Exception as e:
        print(f"Error processing coordinates: {e}")
        return jsonify({'error': 'Internal server error'}), 500


def _process_general_prompt(loc_result, loc_name, coordinates, nearby_features):
    """Process general location prompt and return response."""
    try:
        # Get AI-generated content
        main_content = ai_service.process_location_prompt(
            PROMPT_XML_PATH,
            loc_name if loc_result == 1 else None,
            coordinates,
            nearby_features
        )
        
        # Get video content
        video_content = video_service.get_video_content(
            loc_name if loc_result == 1 else None,
            main_content
        )
        
        return jsonify({
            'main_content': main_content,
            'video_content': video_content,
            'loc_name': loc_name
        })
        
    except Exception as e:
        print(f"Error processing general prompt: {e}")
        return jsonify({
            'main_content': '<h1>Error</h1><p>Could not process location information.</p>',
            'video_content': '<div class="video_container">No video available.</div>',
            'loc_name': loc_name
        }) 