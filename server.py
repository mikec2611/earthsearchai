import openai
import requests
import xml.etree.ElementTree as ET
import re

from os import getenv
from livereload import Server
from flask import Flask, render_template, jsonify, request

openai.organization = getenv("0p3n4I_ORG")
openai.api_key = getenv("0p3n4I_PROJ")
mapbox_token = getenv('MAPBOX_TOKEN')
PORT = 8000

app = Flask(__name__)

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



@app.route('/')
def home():
    return render_template('main.html', mapbox_access_token=mapbox_token)

@app.route('/coordinates', methods=['POST'])
def coordinates():
    data = request.get_json()
    coordinates = str(data['lat']) + ', ' + str(data['lng'])
    loc_result, loc_name = get_location_name(data['lat'], data['lng'])
    print(loc_name)

    if data['prompt_type'] == 'general':
        prompt_main = get_xml_contents('prompts.xml', 'prompt_main')
        prompt_video = get_xml_contents('prompts.xml', 'prompt_video')

        # loc_type_wording changes based on whether the location is known or unknown
        if loc_result == 1:
            prompt_main = prompt_main.replace('[loc_type_wording]', loc_name + '(coordinates at ' + coordinates + ')')
            prompt_video = prompt_video.replace('[loc_type_wording]', loc_name + '(coordinates at ' + coordinates + ')')
        else:
            prompt_main = prompt_main.replace('[loc_type_wording]', 'the location at coordinates:' +  coordinates)
            prompt_video = prompt_video.replace('[loc_type_wording]', 'the location at coordinates:' +  coordinates)

        print('prompt_main', prompt_main)
        print('prompt_video',prompt_video)

        main_content = get_gpt_info(prompt_main)
        video_content = get_gpt_info(prompt_video)

        print('main_content',main_content)
        print('video_content',video_content)

    elif data['prompt_type'] == 'detail':
        print(data['detail_topic'])
        content = 'test'


    

    # print(content)
    # content = '<h1>Pacific Ocean (near Kiribati)</h1> \
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


def get_gpt_info(prompt):
    response = openai.ChatCompletion.create(
        model='gpt-4o',
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
    return response['choices'][0]['message']['content']

def get_location_name(latitude, longitude):
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{longitude},{latitude}.json?access_token={mapbox_token}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        place_name = data['features'][0]['place_name'] if data['features'] else 'Unknown location'
        if place_name == 'Unknown location':
            return 0, place_name
        else:
            return 1, place_name
    else:
        return 0, "Error fetching location name"

if __name__ == '__main__':
    server = Server(app.wsgi_app)
    server.serve(port=PORT, host='127.0.0.1', debug=True)
