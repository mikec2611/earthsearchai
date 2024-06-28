import openai
import requests
from os import getenv
from livereload import Server
from flask import Flask, render_template, jsonify, request

openai.organization = getenv("0p3n4I_ORG")
openai.api_key = getenv("0p3n4I_PROJ")
mapbox_token = getenv('MAPBOX_TOKEN')
PORT = 8000

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('main.html', mapbox_access_token=mapbox_token)

@app.route('/coordinates', methods=['POST'])
def coordinates():
    data = request.get_json()
    coordinates = str(data['lat']) + ', ' + str(data['lng'])
    loc_result, loc_name = get_location_name(data['lat'], data['lng'])
    # print(loc_name)
    # if loc_result == 1:
    #     prompt = 'Reply with information about the location with coordinates: ' + coordinates + \
    #                 ') - be as specific as possible to the exact coordinates and \
    #                      double check that the location you will talk about matches the coordinates provided. \
    #               Your reply must follow the exact html formatting below: \
    #               <h1> Location name only and nothing else whatsoever </h1> \
    #               <p> 5 concise bullet points listing interesting facts and history about the location  \
    #                   in an html <ul> format (only include the <ul> and child <li> elements and closing tags and nothing else). \
    #                   Do not put the coordinates in the answer. \
    #               </p>'
    # else:
    #     prompt = 'Reply with information about about ' + loc_name + '(coordinates at ' + coordinates + \
    #                 ') - be as specific as possible. \
    #               Your reply must follow the exact html formatting below: \
    #               <h1> Location name only and nothing else whatsoever </h1> \
    #               <p> 5 concise bullet points listing interesting facts and history about the location  \
    #                   in an html <ul> format (only include the <ul> and child <li> elements and closing tags and nothing else). \
    #                   Do not put the coordinates in the answer. \
    #               </p>'

    # content = get_gpt_info(prompt)

    # print(content)
    content = '<h1>Pacific Ocean (near Kiribati)</h1> \
                    <p> \
                        <ul> \
                            <li>This location is in the central Pacific Ocean, far from any major landmass.</li> \
                            <li>The nearest land is part of the Republic of Kiribati, a nation consisting of 33 atolls and reef islands.</li> \
                            <li>Kiribati is known for being one of the first countries to see the sunrise each day.</li> \
                            <li>The surrounding waters are home to diverse marine life, including many species of fish and coral.</li> \
                            <li>Kiribati was a significant site during World War II, particularly during the Battle of Tarawa.</li> \
                        </ul> \
                    </p>'
    return jsonify({'content': content})


def get_gpt_info(prompt):
    response = openai.ChatCompletion.create(
        model='gpt-4o',
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant that knows history and geography very well and can identify locations by coordinates."
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
    server.serve(port=PORT, host='0.0.0.0', debug=True)
