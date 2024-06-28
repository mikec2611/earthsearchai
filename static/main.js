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


// Function to create an event listener for a marker
function createMarkerClickListener(markerId) {
    return function(e) {
        e.stopPropagation(); // Prevent the map click event from firing
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
function addMarkerAtClick(event, content) {
    clickCounter++; // Increment the counter for each click

    // Create a marker element
    const markerEl = document.createElement('div');
    markerEl.className = 'marker';
    markerEl.textContent = clickCounter; // Set the marker number

    // Add an event listener to the marker with the correct ID
    markerEl.addEventListener('click', createMarkerClickListener(clickCounter));

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

function addButtonForMarker(markerID, locationTitle, longitude, latitude) {
    const button = document.createElement('button');
    button.classList.add('marker-button');
    button.textContent = markerID + ' - ' + locationTitle; // Set the button text to the marker ID
    document.querySelector('.side-panel-column').appendChild(button);

    // Optional: Add event listener for button
    button.addEventListener('click', () => {
        showMarkerInfo(markerID);
        map.flyTo({center: [longitude, latitude]});
    });
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
            data: JSON.stringify({ 'lat': e.lngLat.lat, 'lng': e.lngLat.lng }),
            success: function(response) {
                // const image_url = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${e.lngLat.lat},${e.lngLat.lng},14,0/600x300?access_token=${mapboxAccessToken}`;
                // console.log(image_url)
                // Add a marker at the clicked location
                
                content = response.content //+ `<img src="${image_url}" alt="Map Image" />`;
                let parser = new DOMParser();
                let doc = parser.parseFromString(content, "text/html");
                let locationTitle = doc.querySelector('h1').textContent; // Extract the text content of the <h1> tag
                clickCounter = addMarkerAtClick(e, content);
                addButtonForMarker(clickCounter, locationTitle, e.lngLat.lng, e.lngLat.lat);
                displayInfoInPanel(content)
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