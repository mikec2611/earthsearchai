import requests
import os
from typing import Tuple, Optional


class LocationService:
    def __init__(self):
        self.mapbox_token = os.environ.get('MAPBOX_TOKEN')
        if not self.mapbox_token:
            raise ValueError("MAPBOX_TOKEN environment variable is required")
    
    def get_location_name(self, latitude: float, longitude: float) -> Tuple[int, str]:
        """
        Get location name from coordinates using Mapbox API.
        
        Returns:
            Tuple[int, str]: (success_code, location_name)
            success_code: 1 for success, 0 for failure
        """
        url = (
            f"https://api.mapbox.com/geocoding/v5/mapbox.places/"
            f"{longitude},{latitude}.json?access_token={self.mapbox_token}"
            f"&types=poi,place,region"
        )
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('features'):
                return 0, 'Unknown location'
            
            # Extract location information with proper prioritization
            poi_name = self._extract_poi_name(data['features'])
            if poi_name:
                return 1, poi_name
            
            # Fallback to place/region/country combination
            place_info = self._extract_place_info(data['features'])
            if place_info:
                return 1, place_info
            
            # Last resort: use the first feature's place_name
            first_feature = data['features'][0]
            return 1, first_feature.get('place_name', 'Unknown location')
            
        except requests.RequestException as e:
            print(f"Error fetching location name: {e}")
            return 0, "Error fetching location name"
        except Exception as e:
            print(f"Unexpected error in get_location_name: {e}")
            return 0, "Unknown location"
    
    def _extract_poi_name(self, features: list) -> Optional[str]:
        """Extract POI name from Mapbox features."""
        for feature in features:
            if 'poi' in feature.get('place_type', []):
                poi_name = feature.get('text', '')
                # Try to get full place name if available
                full_name = feature.get('place_name', poi_name)
                return full_name
        return None
    
    def _extract_place_info(self, features: list) -> Optional[str]:
        """Extract place information from Mapbox features."""
        place_name = None
        region_name = None
        country_name = None
        
        for feature in features:
            place_types = feature.get('place_type', [])
            if 'place' in place_types and not place_name:
                place_name = feature.get('text')
            elif 'region' in place_types and not region_name:
                region_name = feature.get('text')
            elif 'country' in place_types and not country_name:
                country_name = feature.get('text')
        
        # Build location string based on available information
        parts = [name for name in [place_name, region_name, country_name] if name]
        return ', '.join(parts) if parts else None 