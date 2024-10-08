
import requests
import xml.etree.ElementTree as ET
import re
import os


from openai import OpenAI
from bs4 import BeautifulSoup
from livereload import Server
from flask import Flask, render_template, jsonify, request
from googleapiclient.discovery import build
from dotenv import load_dotenv

# project_folder = os.path.expanduser('~/earthsearch')
# load_dotenv(os.path.join(project_folder, '.env'))
# prompt_xml_path = os.path.join(project_folder, 'prompts.xml')
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
        model='gpt-4o-2024-08-06',
        messages=[
            {
                "role": "system",
                "content": "You are an expert assistant specializing in global geography, history, and cultural information. You have comprehensive knowledge of locations worldwide, including their coordinates, historical significance, cultural landmarks, and current socio-economic conditions. When given coordinates or a location name, you can provide detailed, accurate information about that place, including its geography, climate, notable events, and interesting facts. You're also able to compare different locations and discuss how they've changed over time."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        max_tokens=300
    )

    return response.choices[0].message.content

def get_location_name(latitude, longitude):
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{longitude},{latitude}.json?access_token={mapbox_token}&types=place,region"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        place_name = None
        region_name = None
        country_name = None
        if data['features']:
            for feature in data['features']:
                if 'place' in feature['place_type']:
                    place_name = feature['text']
                elif 'region' in feature['place_type']:
                    region_name = feature['text']
                elif 'country' in feature['place_type']:
                    country_name = feature['text']
                if place_name and region_name and country_name:
                    break

            if place_name and region_name and country_name:
                return 1, f"{place_name}, {region_name}, {country_name}"
            elif place_name and region_name:  # Fallback to city and state if country is not found
                return 1, f"{place_name}, {region_name}"
            elif place_name:
                return 1, place_name  # Return just the place name if neither region nor country is found
            else:
                place_name = data['features'][0]['place_name'] if data['features'] else 'Unknown location'
                if place_name == 'Unknown location':
                    return 0, place_name
                else:
                    return 1, place_name
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
    # print(loc_name, coordinates)

    if data['prompt_type'] == 'general':
        prompt_main = get_xml_contents(prompt_xml_path, 'prompt_main')

        if loc_result == 1:
            prompt_main = prompt_main.replace('[loc_type_wording]', loc_name + '(coordinates at ' + coordinates + ')')
        else:
            prompt_main = prompt_main.replace('[loc_type_wording]', 'the location at coordinates:' +  coordinates)
            
        main_content = get_gpt_info(prompt_main)

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

    return jsonify({'main_content': main_content, 'video_content': video_content})



if __name__ == '__main__':
    server = Server(app.wsgi_app)
    server.serve(port=PORT, host='127.0.0.1', debug=False)
