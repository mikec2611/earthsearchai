import os
from typing import Optional
from googleapiclient.discovery import build
from bs4 import BeautifulSoup


class VideoService:
    def __init__(self):
        self.google_api_key = os.environ.get('G00GL3_API_K3Y')
        if not self.google_api_key:
            raise ValueError("G00GL3_API_K3Y environment variable is required")
        
        self.youtube = build('youtube', 'v3', developerKey=self.google_api_key)
    
    def get_video_link(self, search_query: str) -> str:
        """
        Search for a video on YouTube and return the embed link.
        
        Args:
            search_query: The search term for the video
            
        Returns:
            YouTube embed URL or "No video found"
        """
        try:
            request = self.youtube.search().list(
                part="snippet",
                maxResults=1,
                q=search_query,
                type="video",
                videoCategoryId="19"  # Travel & Events category
            )
            response = request.execute()
            
            if response.get('items'):
                video_id = response['items'][0]['id']['videoId']
                return f"https://www.youtube.com/embed/{video_id}"
            
            return "No video found"
            
        except Exception as e:
            print(f"Error fetching video: {e}")
            return "No video found"
    
    def get_video_from_content(self, html_content: str) -> str:
        """
        Extract location name from HTML content and search for related video.
        
        Args:
            html_content: HTML content containing location information
            
        Returns:
            HTML iframe string or "No video found"
        """
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            h1_tag = soup.find('h1')
            
            if not h1_tag:
                return "No video found"
            
            location_name = h1_tag.get_text(strip=True)
            if not location_name:
                return "No video found"
            
            video_link = self.get_video_link(location_name)
            
            if video_link != "No video found":
                return self._create_video_iframe(video_link)
            
            return "No video found"
            
        except Exception as e:
            print(f"Error processing video content: {e}")
            return "No video found"
    
    def get_video_content(self, location_name: Optional[str], html_content: str) -> str:
        """
        Get video content for a location, trying location name first, then HTML content.
        
        Args:
            location_name: Name of the location
            html_content: HTML content as fallback
            
        Returns:
            HTML iframe string or default message
        """
        default_message = '<div class="video_container">No video found for this location.</div>'
        
        # Try with location name first
        if location_name:
            video_link = self.get_video_link(location_name)
            if video_link != "No video found":
                return self._create_video_iframe(video_link)
        
        # Fallback to extracting from HTML content
        video_from_content = self.get_video_from_content(html_content)
        if video_from_content != "No video found":
            return video_from_content
        
        return default_message
    
    def _create_video_iframe(self, video_url: str) -> str:
        """Create HTML iframe for video."""
        return (
            f'<iframe class="video_container" src="{video_url}" '
            f'frameborder="0" allow="accelerometer; autoplay; clipboard-write; '
            f'encrypted-media; gyroscope; picture-in-picture" allowfullscreen>'
            f'</iframe>'
        ) 