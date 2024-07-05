mapboxgl.accessToken = mapboxAccessToken;
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v11',
    projection: 'globe', 
    zoom: 1.5,
    center: [-90, 40]
});



map.on('wheel', () => {
    userInteracting = true;
    if (spinEnabled) {
        map.stop();
    }
    if (scrollTimeout !== undefined) {
        clearTimeout(scrollTimeout);
    }
    scrollTimeout = setTimeout(() => {
        if (!userInteracting && !spinEnabled) {
            spinGlobe();
        }
        userInteracting = false;
    }, 200);
});

map.on('style.load', () => {
    map.setFog({'horizon-blend': 0.08}); 
});

const secondsPerRevolution = 120;
const maxSpinZoom = 5;
const slowSpinZoom = 3;

let userInteracting = false;
let spinEnabled = true;
let scrollTimeout;
let clickCounter = 0; // Counter for clicks and marker IDs
let savedLocations = []; // Array to store location details
let isPanelShown = false;

function displayInfoInPanel(content) {
    document.getElementById('content_container').innerHTML = content;
    if (!isPanelShown) {
        const sidePanel = document.querySelector('.side-panel');
        sidePanel.style.transform = 'translateX(0)';
        $('#map').css('margin-left', '10%');
        $('#map_rotate_btns').css('margin-left', '10%');
        map.resize();
        isPanelShown = true;
    }
}

function spinGlobe() {
    const zoom = map.getZoom();
    if (spinEnabled && !userInteracting && zoom < maxSpinZoom) {
        let distancePerSecond = 360 / secondsPerRevolution;
        if (zoom > slowSpinZoom) {
            // Slow spinning at higher zooms
            const zoomDif =
                (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
            distancePerSecond *= zoomDif;
        }
        const center = map.getCenter();
        center.lng -= distancePerSecond;
        // Smoothly animate the map over one second.
        // When this animation is complete, it calls a 'moveend' event.
        map.easeTo({ center, duration: 1000, easing: (n) => n });
    }
}

function highlight_active_marker(markerId) {
    document.querySelectorAll('.marker').forEach(markerEl => {
        markerEl.classList.remove('active_marker');
    });

    document.querySelectorAll('.marker_button').forEach(buttonEl => {
        buttonEl.classList.remove('active_marker');
    });

    $('#marker_' + markerId).addClass('active_marker');
    $('#marker_button_' + markerId).addClass('active_marker');
}


// Function to create an event listener for a marker
function createMarkerClickListener(markerId) {
    return function(e) {
        e.stopPropagation(); // Prevent the map click event from firing

        highlight_active_marker(markerId)

        showMarkerInfo(markerId); // Show information for this marker
    };
}

// Function to display marker information
function showMarkerInfo(markerId) {
    // Find the marker information from savedLocations
    const markerInfo = savedLocations.find(location => location.id === markerId);
    content = markerInfo.content
    if (markerInfo) {
        displayInfoInPanel(content)
    }
}

// Modified addMarkerAtClick function to include marker click listener with correct ID
function addMarkerAtClick(event, content, location_title) {
    clickCounter++; // Increment the counter for each click

    // Create a marker element
    const markerEl = document.createElement('div');
    markerEl.id = 'marker_' + clickCounter;
    markerEl.className = 'marker';
    markerEl.textContent = clickCounter; // Set the marker number

    // Add an event listener to the marker with the correct ID
    markerEl.addEventListener('click', createMarkerClickListener(clickCounter));
    markerEl.title = location_title;

    // Assuming you're using Mapbox GL JS to add the marker to the map
    new mapboxgl.Marker(markerEl)
        .setLngLat(event.lngLat) // Set marker position to click location
        .addTo(map);

    // Save the clicked location with the marker ID
    savedLocations.push({
        id: clickCounter,
        lngLat: event.lngLat,
        content: content
    });

    return clickCounter
}

function addButtonForMarker(markerID, locationTitle, longitude, latitude, video_content) {
    const button = document.createElement('button');
    button.id = 'marker_button_' + markerID;
    button.classList.add('marker_button');
    button.textContent = markerID + ' - ' + locationTitle; // Set the button text to the marker ID
    button.setAttribute('data-video-content', video_content);
    button.setAttribute('type', 'button')
    document.querySelector('.side-panel-column').appendChild(button);

    // Optional: Add event listener for button
    button.addEventListener('click', () => {
        showMarkerInfo(markerID);
        map.flyTo({center: [longitude, latitude]});
        highlight_active_marker(markerID)
        embed_loc_video(button.getAttribute('data-video-content'));
    });
}

function embed_loc_video(location_video) {
    document.getElementById('loc_video').innerHTML = location_video
}

function startRotation() {
    spinEnabled = true;
    spinGlobe();
}

function stopRotation() {
    spinEnabled = false;
}


// Example function to show side panel with specific content
function showSidePanel(content) {
    document.getElementById('side-panel').innerHTML = content;
    document.querySelector('.side-panel').style.transform = 'translateX(0)';
}

// Example function to hide side panel
function hideSidePanel() {
    document.querySelector('.side-panel').style.transform = 'translateX(-100%)';
}

// Pause spinning on interaction
map.on('mousedown', () => {
    userInteracting = true;
});

// Restart spinning the globe when interaction is complete
map.on('mouseup', () => {
    userInteracting = false;
    spinGlobe();
});

// These events account for cases where the mouse has moved
// off the map, so 'mouseup' will not be fired.
map.on('dragend', () => {
    userInteracting = false;
    spinGlobe();
});

map.on('pitchend', () => {
    userInteracting = false;
    spinGlobe();
});
map.on('rotateend', () => {
    userInteracting = false;
    spinGlobe();
});

// When animation is complete, start spinning if there is no ongoing interaction
map.on('moveend', () => {
    spinGlobe();
});

// Listen for wheel event to pause rotation
map.on('wheel', () => {
    userInteracting = true;
    if (spinEnabled) {
        map.stop(); // Immediately end ongoing animation
    }
    // Clear the timeout if it exists
    if (scrollTimeout !== undefined) {
        clearTimeout(scrollTimeout);
    }
    // Set a timeout to restart the rotation
    scrollTimeout = setTimeout(() => {
        if (!userInteracting && !spinEnabled) {
            spinGlobe();
        }
        userInteracting = false;
    }, 200); // 200ms without a 'wheel' event is considered the end of scrolling
});

let debounceTimer;
map.on('click', function(e) {
    clearTimeout(debounceTimer);
    document.getElementById('loadingIndicator').style.display = 'block';
    debounceTimer = setTimeout(() => {
        $.ajax({
            url: '/coordinates',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 'lat': e.lngLat.lat, 
                                    'lng': e.lngLat.lng, 
                                    'prompt_type': 'general',  
                                    'detail_topic': 'general' 
                                }),
            success: function(response) {
                let parser = new DOMParser();
                main_content = response.main_content
                let reponse_main_content = parser.parseFromString(main_content, "text/html");
                video_content = response.video_content

                // set marker
                let location_title = reponse_main_content.querySelector('h1').textContent;
                clickCounter = addMarkerAtClick(e, main_content, location_title);
                addButtonForMarker(clickCounter, location_title, e.lngLat.lng, e.lngLat.lat, video_content);
                highlight_active_marker(clickCounter)

                // video embed;
                embed_loc_video(video_content)
                
                // display main_content
                displayInfoInPanel(main_content)
                
                document.getElementById('loadingIndicator').style.display = 'none';
            },
            error: function(error) {
                console.log(error);
                document.getElementById('loadingIndicator').style.display = 'none';
            }
        });
    }, 500);
});

let debounceTimerInfo;
$('.info_button').on('click', function(e) {
    let detail_topic = $(this).text();
    clearTimeout(debounceTimerInfo);
    document.getElementById('loadingIndicator').style.display = 'block';
    debounceTimerInfo = setTimeout(() => {
        $.ajax({
            url: '/coordinates',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 'lat': 'detail', 
                                    'lng': 'detail', 
                                    'prompt_type': 'detail',  
                                    'detail_topic': detail_topic 
                                }),
            success: function(response) {
                // content = response.content
                // let parser = new DOMParser();
                // let doc = parser.parseFromString(content, "text/html");
                // let locationTitle = doc.querySelector('h1').textContent; // Extract the text content of the <h1> tag
                
                document.getElementById('loadingIndicator').style.display = 'none';
            },
            error: function(error) {
                console.log(error);
                document.getElementById('loadingIndicator').style.display = 'none';
            }
        });
    }, 500);
});

document.getElementById('playButton').addEventListener('click', function() {
    startRotation();
    spinGlobe();
    this.setAttribute('disabled', '');
    document.getElementById('pauseButton').removeAttribute('disabled');
});

document.getElementById('pauseButton').addEventListener('click', function() {
    stopRotation();
    this.setAttribute('disabled', '');
    document.getElementById('playButton').removeAttribute('disabled');
});

spinGlobe();