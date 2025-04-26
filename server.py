import requests
import xml.etree.ElementTree as ET
import re
import os
import json


from openai import OpenAI
from bs4 import BeautifulSoup
from livereload import Server
from flask import Flask, render_template, jsonify, request, render_template_string
from googleapiclient.discovery import build
from dotenv import load_dotenv

# prod
# project_folder = os.path.expanduser('~/earthsearch')
# load_dotenv(os.path.join(project_folder, '.env'))
# prompt_xml_path = os.path.join(project_folder, 'prompts.xml')

# # local debug
load_dotenv()
prompt_xml_path = "prompts.xml"

mapbox_token = os.environ.get('MAPBOX_TOKEN')
google_api_key = os.environ.get('G00GL3_API_K3Y')
PORT = 8000

app = Flask(__name__)
client = OpenAI()

def get_xml_contents(xml_file, xml_tag):
    tree = ET.parse(xml_file)
    root = tree.getroot()
    contents = root.find(xml_tag)
    if contents is not None:
        contents = re.sub(r'<!\[CDATA\[|\]\]>', '', contents.text)  # Remove CDATA section tags if present
        contents = re.sub(r'\s+', ' ', contents).strip()  # Collapse multiple spaces
        contents = contents.replace("\\", "")
        contents = contents.replace("'", "")
    else:
        contents = ""
        
    return contents

def get_gpt_info(prompt):
    response = client.chat.completions.create(
        model="gpt-4.1-nano-2025-04-14",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content

def get_location_name(latitude, longitude):
    # Include 'poi' in the types parameter to fetch points of interest including natural features
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{longitude},{latitude}.json?access_token={mapbox_token}&types=poi,place,region"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        poi_name = None  # Add variable for POI name
        place_name = None
        region_name = None
        country_name = None
        if data['features']:
            # Prioritize POI if available
            for feature in data['features']:
                if 'poi' in feature['place_type']:
                    poi_name = feature['text']
                    break # Found POI, no need to check others for POI specifically
            
            # If no POI found, check for place, region, country
            if not poi_name:
                for feature in data['features']:
                    if 'place' in feature['place_type']:
                        place_name = feature['text']
                    elif 'region' in feature['place_type']:
                        region_name = feature['text']
                    elif 'country' in feature['place_type']:
                        country_name = feature['text']
                    # Optimization: break if we found the most specific combination possible without POI
                    if place_name and region_name and country_name: 
                        break

            # Return POI name if found
            if poi_name:
                 # Attempt to extract a more complete name if available (e.g., "Great Salt Lake, Utah, United States")
                 # Fallback to just the POI text if 'place_name' isn't useful
                 full_poi_name = next((f['place_name'] for f in data['features'] if 'poi' in f['place_type'] and f['text'] == poi_name), poi_name)
                 return 1, full_poi_name

            # Fallback logic if no POI found
            if place_name and region_name and country_name:
                return 1, f"{place_name}, {region_name}, {country_name}"
            elif place_name and region_name:
                return 1, f"{place_name}, {region_name}"
            elif place_name:
                return 1, place_name
            else: # If only country or region found, or nothing specific
                 # Use the most descriptive name available from the first feature as a last resort
                place_name = data['features'][0]['place_name'] if data['features'] else 'Unknown location'
                if place_name == 'Unknown location':
                    return 0, place_name
                else:
                    # Attempt to refine the generic place_name
                    first_feature = data['features'][0]
                    refined_name = first_feature.get('text', place_name) # Prefer 'text' if available
                    context = first_feature.get('context', [])
                    if context:
                       # Add region/country from context if available
                       region = next((item['text'] for item in context if 'region' in item['id']), None)
                       country = next((item['text'] for item in context if 'country' in item['id']), None)
                       if region and country:
                           refined_name = f"{refined_name}, {region}, {country}"
                       elif region:
                           refined_name = f"{refined_name}, {region}"
                       elif country:
                           refined_name = f"{refined_name}, {country}"

                    return 1, refined_name
        else:
            return 0, 'Unknown location'
    else:
        return 0, "Error fetching location name"

def get_video_link(search_video_desc):
    search_video_desc = search_video_desc
    youtube = build('youtube', 'v3', developerKey=google_api_key)
    request = youtube.search().list(
        part="snippet",
        maxResults=1,
        q=search_video_desc,
        type="video",
        videoCategoryId="19"
    )
    response = request.execute()
    
    if response['items']:
        video_id = response['items'][0]['id']['videoId']
        video_link = f"https://www.youtube.com/embed/{video_id}"
        return video_link
    else:
        return "No video found"

def get_video_link_main_content(main_content):
    html_response = BeautifulSoup(main_content, 'html.parser')
    main_content_loc = html_response.find('h1').text.strip() if html_response else 0
    if main_content_loc != 0: 
        video_link = get_video_link(main_content_loc)
        if video_link != 'No video found':
            video_content = f'<iframe class="video_container" src="{video_link}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
            return video_content
    
    return 'No video found'

@app.route('/')
def home():
    return render_template('main.html', mapbox_access_token=mapbox_token)

@app.route('/coordinates', methods=['POST'])
def coordinates():
    data = request.get_json()
    lat = round(data['lat'], 3)
    lng = round(data['lng'], 3)
    coordinates = str(lat) + ', ' + str(lng)
    loc_result, loc_name = get_location_name(lat, lng)
    nearby_features = data.get('nearby_features', []) # Get nearby features, default to empty list
    # print(loc_name, coordinates)

    if data['prompt_type'] == 'general':
        prompt_template_str = get_xml_contents(prompt_xml_path, 'prompt_main')

        # Prepare context for the template
        template_context = {
            'loc_name': loc_name if loc_result == 1 else None, # Pass loc_name only if valid
            'coordinates': coordinates,
            'nearby_features': nearby_features
        }
        
        # Render the prompt using the template string and context
        rendered_prompt = render_template_string(prompt_template_str, **template_context)
        print("Rendered Prompt:", rendered_prompt) # Optional: Debugging

        gpt_response_raw = get_gpt_info(rendered_prompt)
        print("Raw GPT Response:", gpt_response_raw) # Optional: Debugging

        main_content_html = "<h1>Error</h1><p>Could not parse AI response.</p>" # Default error HTML
        try:
            # Clean potential markdown ```json ... ``` wrapping
            if gpt_response_raw.strip().startswith("```json"):
                gpt_response_clean = gpt_response_raw.strip()[7:-3].strip()
            elif gpt_response_raw.strip().startswith("```"):
                 gpt_response_clean = gpt_response_raw.strip()[3:-3].strip()
            else:
                gpt_response_clean = gpt_response_raw
                
            gpt_data = json.loads(gpt_response_clean) 
            location_name_from_gpt = gpt_data.get("location_name", "Unknown Location")
            facts = gpt_data.get("facts", [])

            # Build the HTML string from the parsed JSON
            main_content_html = f"<h1>{location_name_from_gpt}</h1>"
            for fact in facts:
                category = fact.get("category", "")
                content = fact.get("content", "")
                main_content_html += f'<p class="info-item"><b class="category-title">{category}:</b> {content}</p>'

        except json.JSONDecodeError as e:
            print(f"Error decoding GPT JSON response: {e}")
            # Keep the default error HTML or use the raw response if preferred
            # main_content_html = f"<h1>Error</h1><p>Could not parse AI response.</p><pre>{gpt_response_raw}</pre>"
        except Exception as e:
             print(f"An unexpected error occurred processing GPT response: {e}")
        
        main_content = main_content_html # Assign the generated HTML to main_content

        video_content = '<div class="video_container">No video found for this location.</div>'
        if loc_result == 1:
            # video_link = 'https://www.youtube.com/embed/2LSyizrk8-0'
            video_link = get_video_link(loc_name) # try to get video from location name
            if video_link != 'No video found':
                video_content = f'<iframe class="video_container" src="{video_link}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
            else:
                main_content_video_link = get_video_link_main_content(main_content) # try to get video from main_content location name
                if main_content_video_link != 'No video found':
                    video_content = main_content_video_link
        else:
            main_content_video_link = get_video_link_main_content(main_content) # try to get video from main_content location name
            if main_content_video_link != 'No video found':
                video_content = main_content_video_link
            

            
        # print(video_content)
        # print('main_content',main_content)

    elif data['prompt_type'] == 'detail':
        print(data['detail_topic'])
        main_content = 'test'
        video_content = 'test'


    # main_content = '<h1>Pacific Ocean (near Kiribati)</h1> \
    #                 <p> \
    #                     <ul> \
    #                         <li>This location is in the central Pacific Ocean, far from any major landmass.</li> \
    #                         <li>The nearest land is part of the Republic of Kiribati, a nation consisting of 33 atolls and reef islands.</li> \
    #                         <li>Kiribati is known for being one of the first countries to see the sunrise each day.</li> \
    #                         <li>The surrounding waters are home to diverse marine life, including many species of fish and coral.</li> \
    #                         <li>Kiribati was a significant site during World War II, particularly during the Battle of Tarawa.</li> \
    #                     </ul> \
    #                 </p>'

    return jsonify({'main_content': main_content, 'video_content': video_content, 'loc_name': loc_name})



if __name__ == '__main__':
    server = Server(app.wsgi_app)
    server.serve(port=PORT, host='127.0.0.1', debug=False)
