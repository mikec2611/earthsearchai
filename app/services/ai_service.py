import xml.etree.ElementTree as ET
import re
import json
import html
from typing import Dict, List, Optional
from openai import OpenAI
from flask import render_template_string


class AIService:
    def __init__(self):
        self.client = OpenAI()
    
    def get_xml_contents(self, xml_file: str, xml_tag: str) -> str:
        """Extract content from XML file by tag name."""
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            contents = root.find(xml_tag)
            
            if contents is not None:
                # Remove CDATA section tags if present
                content_text = re.sub(r'<!\[CDATA\[|\]\]>', '', contents.text or '')
                # Collapse multiple spaces
                content_text = re.sub(r'\s+', ' ', content_text).strip()
                # Clean up escape characters
                content_text = content_text.replace("\\", "").replace("'", "")
                return content_text
            
            return ""
        except ET.ParseError as e:
            print(f"Error parsing XML file {xml_file}: {e}")
            return ""
        except Exception as e:
            print(f"Unexpected error reading XML: {e}")
            return ""
    
    def get_location_info(self, prompt: str) -> str:
        """Get location information from OpenAI API."""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Using a more current model
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=800
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error getting AI response: {e}")
            return ""
    
    def process_location_prompt(
        self, 
        prompt_xml_path: str, 
        loc_name: Optional[str], 
        coordinates: str, 
        nearby_features: List[str]
    ) -> str:
        """Process location prompt and return formatted HTML content."""
        try:
            prompt_template_str = self.get_xml_contents(prompt_xml_path, 'prompt_main')
            
            if not prompt_template_str:
                return "<h1>Error</h1><p>Could not load prompt template.</p>"
            
            # Prepare context for the template
            template_context = {
                'loc_name': loc_name,
                'coordinates': coordinates,
                'nearby_features': nearby_features
            }
            
            # Render the prompt using the template string and context
            rendered_prompt = render_template_string(prompt_template_str, **template_context)
            
            # Get AI response
            gpt_response_raw = self.get_location_info(rendered_prompt)
            
            if not gpt_response_raw:
                return "<h1>Error</h1><p>Could not get AI response.</p>"
            
            # Process the AI response
            return self._process_ai_response(gpt_response_raw)
            
        except Exception as e:
            print(f"Error processing location prompt: {e}")
            return "<h1>Error</h1><p>Could not process location information.</p>"
    
    def _process_ai_response(self, gpt_response_raw: str) -> str:
        """Process raw AI response into formatted HTML."""
        try:
            # Clean potential markdown wrapping
            gpt_response_clean = self._clean_json_response(gpt_response_raw)
            
            # Parse JSON response
            gpt_data = json.loads(gpt_response_clean)
            
            # Extract data with proper escaping
            location_name = html.escape(gpt_data.get("location_name", "Unknown Location"))
            facts = gpt_data.get("facts", [])
            
            # Build HTML string
            main_content_html = f"<h1>{location_name}</h1>"
            main_content_html += '<ul class="info-list">'
            
            for fact in facts:
                category = html.escape(fact.get("category", ""))
                content = html.escape(fact.get("content", ""))
                main_content_html += (
                    f'<li class="info-item">'
                    f'<b class="category-title">{category} -</b> {content}'
                    f'</li>'
                )
            
            main_content_html += "</ul>"
            return main_content_html
            
        except json.JSONDecodeError as e:
            print(f"Error decoding GPT JSON response: {e}")
            return "<h1>Error</h1><p>Could not parse AI response.</p>"
        except Exception as e:
            print(f"Unexpected error processing AI response: {e}")
            return "<h1>Error</h1><p>Could not process AI response.</p>"
    
    def _clean_json_response(self, response: str) -> str:
        """Clean JSON response from potential markdown wrapping."""
        response = response.strip()
        
        if response.startswith("```json"):
            return response[7:-3].strip()
        elif response.startswith("```"):
            return response[3:-3].strip()
        
        return response 