mapboxgl.accessToken = mapboxAccessToken;

function getZoomLevel() {
    const screenWidth = window.innerWidth;

    if (screenWidth >= 1500) {
        return 2.5; // Large screens
    } else if (screenWidth >= 992) {
        return 2; // Medium screens
    } else if (screenWidth >= 768) {
        return 1.5; // Small screens
    } else {
        return 1; // Extra small screens
    }
}

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v11',
    projection: 'globe', 
    zoom: getZoomLevel(),
    center: [-90, 40],
    dragRotate: true,
    touchZoomRotate: true,
    pitchWithRotate: true, // Enable touch pitch
    dragPan: {
        inertia: 300 // Increase inertia for smoother dragging
    }
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
const secondsPerRevolutionFast = 2;
const maxSpinZoom = 5;
const slowSpinZoom = 3;

let searchCount = 0;
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
        // $('#map').css('margin-left', '10%');
        // $('#map_rotate_btns').css('margin-left', '10%');
        // map.resize();
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

function fastSpinGlobe() {
    let distancePerSecond = 360 / secondsPerRevolutionFast;
    const center = map.getCenter();
    center.lng -= distancePerSecond;
    map.easeTo({ center, duration: 1000, easing: (n) => n });
}
function highlight_active_marker(markerId) {
    document.querySelectorAll('.marker').forEach(markerEl => {
        markerEl.classList.remove('active_marker');
    });

    document.querySelectorAll('.marker_button').forEach(buttonEl => {
        buttonEl.classList.remove('active_marker');
    });

    const markerElement = document.getElementById('marker_' + markerId);
    if (markerElement) {
        markerElement.classList.add('active_marker');
    }
    const buttonElement = document.getElementById('marker_button_' + markerId);
    if (buttonElement) {
        buttonElement.classList.add('active_marker');
    }
}


// Function to create an event listener for a marker
function createMarkerClickListener(markerId) {
    return function(e) {
        e.stopPropagation(); // Prevent the map click event from firing

        // Fly to the marker location
        const markerInfo = savedLocations.find(location => location.id === markerId);
        map.flyTo({
            center: markerInfo.lngLat,
            essential: true // this animation is considered essential with respect to prefers-reduced-motion
        });
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
function addMarkerAtClick(lngLat, content, location_title) {
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
        .setLngLat(lngLat) // Set marker position to click location
        .addTo(map);

    map.flyTo({center: [lngLat.lng, lngLat.lat]});

    // Save the clicked location with the marker ID
    savedLocations.push({
        id: clickCounter,
        lngLat: lngLat,
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
    document.querySelector('.locaton_history').appendChild(button);

    // Optional: Add event listener for button
    button.addEventListener('click', () => {
        showMarkerInfo(markerID);
        map.flyTo({center: [longitude, latitude]});
        highlight_active_marker(markerID)
        embed_loc_video(button.getAttribute('data-video-content'));
        // Fetch weather when a history button is clicked
        // Pass locationTitle as a hint for weather display
        fetchWeatherForecast(latitude, longitude, locationTitle); 
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
let isRunning = false;
map.on('click', function(e) {
    if (isRunning) {
        return; // Exit if the function is already running
    }

    // --- START: New code to query rendered features ---
    // Define a small pixel buffer (radius)
    const queryRadius = 50;
    const queryPoint = e.point;
    const bbox = [
        [queryPoint.x - queryRadius, queryPoint.y - queryRadius],
        [queryPoint.x + queryRadius, queryPoint.y + queryRadius]
    ];
    const features = map.queryRenderedFeatures(bbox); // Query within the bounding box

    // Define prioritized layers *before* using them in the filter
    const labelLayerPriority = [
        'natural-point-label', 'water-point-label', 'place-label', 
        'poi-label', 'road-label', 'settlement-label' 
        // Add more specific layer IDs from your style if needed
    ];

    // Filter features: only include those from relevant layers AND having a name property
    const relevantFeatures = features.filter(f => 
        f.properties && (f.properties.name || f.properties.name_en) &&
        (f.layer.type === 'symbol' || labelLayerPriority.some(layerId => f.layer.id.includes(layerId)))
    );

    let foundLabel = null;
    if (relevantFeatures.length > 0) {
        // Find the first feature from the prioritized list, or the first symbol otherwise
        let bestFeature = relevantFeatures.find(f => labelLayerPriority.some(layerId => f.layer.id.includes(layerId)));
        if (!bestFeature) {
            bestFeature = relevantFeatures[0]; // Fallback to the first relevant feature if no priority match
        }
        foundLabel = bestFeature.properties.name || bestFeature.properties.name_en;
    }


    // Extract names from relevant features
    const nearbyFeatureNames = relevantFeatures.map(f => f.properties.name || f.properties.name_en);
    
    // Debounce the main backend call
    clearTimeout(debounceTimer);
    document.getElementById('loadingIndicator').style.display = 'block'; // Keep showing loading indicator

    debounceTimer = setTimeout(() => {
        isRunning = true;

        // Pass the nearby feature names to the backend process
        run_location_process(e.lngLat, nearbyFeatureNames)
        .then(result => {
            isRunning = false; // Reset the flag when the function finishes
            document.getElementById('loadingIndicator').style.display = 'none';
        })
        .catch(error => {
            console.log(error);
            isRunning = false; // Reset the flag when the function finishes
            document.getElementById('loadingIndicator').style.display = 'none';
        })
        .finally(() => {
            isRunning = false; // Reset the flag when the function finishes
            document.getElementById('loadingIndicator').style.display = 'none';
        });
    }, 500);
});

document.getElementById('location_search').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        const searchTerm = this.value;
        if (!searchTerm) {
            return;
        }

        // Use Mapbox Geocoding API to search for the location
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchTerm)}.json?access_token=${mapboxgl.accessToken}`)
            .then(response => response.json())
            .then(data => {
                if (data.features && data.features.length > 0) {
                    const [longitude, latitude] = data.features[0].center;
                    map.flyTo({
                        center: [longitude, latitude],
                        essential: true // this animation is considered essential with respect to prefers-reduced-motion
                    });
                    const lngLat = {lng: longitude, lat: latitude};
                    document.getElementById('loadingIndicator').style.display = 'block';
                    run_location_process(lngLat)
                    .then(result => {
                        isRunning = false; // Reset the flag when the function finishes
                        document.getElementById('loadingIndicator').style.display = 'none';
                    })
                    .catch(error => {
                        console.log(error);
                        isRunning = false; // Reset the flag when the function finishes
                        document.getElementById('loadingIndicator').style.display = 'none';
                    })
                    .finally(() => {
                        isRunning = false; // Reset the flag when the function finishes
                        document.getElementById('loadingIndicator').style.display = 'none';
                    });
                    this.value = '';
                } else { 
                    console.log('Location not found');
                    this.value = '';
                }
            })
            .catch(error => console.log('Error fetching location:', error));
    }
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

document.getElementById('randomButton').addEventListener('click', function() {
    document.getElementById('loadingIndicator').style.display = 'block';

    let spinInterval = setInterval(() => {
        fastSpinGlobe();
    }, 100); 

    const randomLat = (Math.random() * 180) - 90;
    const randomLng = (Math.random() * 360) - 180;
    const randomCoordinates = { lat: randomLat, lng: randomLng };
    run_location_process(randomCoordinates)
    .then(result => {
        isRunning = false; // Reset the flag when the function finishes
        document.getElementById('loadingIndicator').style.display = 'none';
        clearInterval(spinInterval);
    })
    .catch(error => {
        console.log(error);
        isRunning = false; // Reset the flag when the function finishes
        document.getElementById('loadingIndicator').style.display = 'none';
        clearInterval(spinInterval);
    })
    .finally(() => {
        isRunning = false; // Reset the flag when the function finishes
        document.getElementById('loadingIndicator').style.display = 'none';
        clearInterval(spinInterval);
    });
});



function run_location_process(lngLat, nearbyFeatureNames = []){
    return new Promise(async (resolve, reject) => {
        const foundLocation = savedLocations.find(location =>
            location.lngLat.lat === lngLat.lat && location.lngLat.lng === lngLat.lng
        );
        if (foundLocation) {
            map.flyTo({
                center: foundLocation.lngLat,
                essential: true
            });
            highlight_active_marker(foundLocation.id)
            showMarkerInfo(foundLocation.id);
            // If cached, fetch weather too
            // Try to get location title from the button for the hint
            const buttonElement = document.getElementById('marker_button_' + foundLocation.id);
            let cachedLocationTitle = 'Location'; // Default hint
            if (buttonElement) {
                 // Extract title, removing the "ID - " part
                 const buttonText = buttonElement.textContent;
                 cachedLocationTitle = buttonText.substring(buttonText.indexOf('-') + 1).trim(); 
                 embed_loc_video(buttonElement.getAttribute('data-video-content'));
            }
            fetchWeatherForecast(foundLocation.lngLat.lat, foundLocation.lngLat.lng, cachedLocationTitle);
            resolve('Location retrieved from cache'); // Resolve promise for cached case
            return;
        }

        // Replace $.ajax with fetch
        try {
            const response = await fetch('/coordinates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'lat': lngLat.lat,
                    'lng': lngLat.lng,
                    'prompt_type': 'general',
                    'detail_topic': 'general', // Keep this for now, might be used later
                    'nearby_features': nearbyFeatureNames // Add nearby features to the payload
                }),
            });

            if (!response.ok) {
                // Handle HTTP errors (like 500, 404 etc.)
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Success logic (moved from success callback)
            let parser = new DOMParser();
            let main_content = data.main_content;
            let reponse_main_content = parser.parseFromString(main_content, "text/html");
            let video_content = data.video_content;
            let loc_name = data.loc_name; // Get loc_name from response

            // set marker
            let h1Element = reponse_main_content.querySelector('h1');
            let location_title;
            if (h1Element && h1Element.textContent.trim()) {
                location_title = h1Element.textContent.trim();
            } else {
                // Fallback to loc_name if H1 is missing or empty
                location_title = loc_name ? loc_name : 'Unknown Location';
            }

            let newMarkerId = addMarkerAtClick(lngLat, main_content, location_title); // Use returned ID
            addButtonForMarker(newMarkerId, location_title, lngLat.lng, lngLat.lat, video_content);
            highlight_active_marker(newMarkerId); // Highlight the newly added marker

            // video embed;
            embed_loc_video(video_content);

            // display main_content
            displayInfoInPanel(main_content);

            // Fetch weather for the clicked location, passing location_title as a hint
            fetchWeatherForecast(lngLat.lat, lngLat.lng, location_title);

            resolve('Location processed successfully');

        } catch (error) {
            console.error("Error processing location:", error); // Log the error
            // Optionally: Display a user-friendly error message in the UI
            displayInfoInPanel("<p>Sorry, couldn't fetch information for this location.</p>");
            reject('Error processing location: ' + error.message); // Reject the promise
        }
    });
}

spinGlobe();

// --- Utility Functions ---
// Debounce function to limit the rate at which a function can fire.
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

// --- Reverse Geocode Function ---
async function reverseGeocode(latitude, longitude) {
    const accessToken = mapboxgl.accessToken; // Use the global token
    if (!accessToken) {
        console.error('Mapbox Access Token is not available for reverse geocoding.');
        return `Area near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`; // Fallback if token missing
    }
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${accessToken}&types=place,locality,neighborhood,address,poi`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Mapbox API Error: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            // Prioritize different feature types if needed, otherwise take the first
            return data.features[0].place_name; // Or a more specific property like context
        } else {
            return `Area near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`; // Fallback if no features found
        }
    } catch (error) {
        console.error('Error during reverse geocoding:', error);
        return `Area near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`; // Fallback on error
    }
}

// --- Panel Height Adjustment ---
function adjustSidePanelHeight() {
    const appTitle = document.getElementById('app_title');
    const sidePanel = document.getElementById('side-panel');
    const showPanelButton = document.getElementById('showPanelButton'); // Also adjust show button position

    if (appTitle && sidePanel) {
        const appTitleRect = appTitle.getBoundingClientRect();
        const panelTopMargin = 15; // Space between title and panel
        const panelBottomMargin = 10; // Space between panel bottom and viewport bottom

        const panelTop = appTitleRect.bottom + panelTopMargin;
        const panelHeight = window.innerHeight - panelTop - panelBottomMargin;

        sidePanel.style.top = `${panelTop}px`;
        sidePanel.style.height = `${panelHeight}px`;

        // Adjust show button position to match panel's intended top/left when hidden
        if (showPanelButton) {
            showPanelButton.style.top = `${panelTop}px`;
            // showPanelButton.style.left is already handled by CSS (left: 10px)
        }
    }
}

// Tutorial Logic
document.addEventListener('DOMContentLoaded', (event) => {
    const tutorialModal = document.getElementById('tutorialModal');
    const tutorialOverlay = document.getElementById('tutorialOverlay');
    const closeTutorialButton = document.getElementById('closeTutorial');
    const sidePanel = document.getElementById('side-panel'); // Get side panel element
    const hidePanelButton = document.getElementById('hidePanelButton'); // Get hide button element
    const showPanelButton = document.getElementById('showPanelButton'); // Get show button element

    // Check if the user has visited before
    if (!localStorage.getItem('hasVisitedEarthSearch')) {
        // Show the modal and overlay
        tutorialModal.style.display = 'block';
        tutorialOverlay.style.display = 'block';
    }

    // Add event listener for the close button
    closeTutorialButton.addEventListener('click', () => {
        tutorialModal.style.display = 'none';
        tutorialOverlay.style.display = 'none';
        // Set the flag in localStorage so it doesn't show again
        localStorage.setItem('hasVisitedEarthSearch', 'true');
    });

    // Add event listener for the hide panel button
    if (hidePanelButton && sidePanel && showPanelButton) {
        hidePanelButton.addEventListener('click', () => {
            sidePanel.classList.add('hidden'); 
            showPanelButton.style.display = 'block'; // Directly show the button
        });
    }

    // Add event listener for the show panel button
    if (showPanelButton && sidePanel) {
        showPanelButton.addEventListener('click', () => {
            sidePanel.classList.remove('hidden'); // Show the panel
            showPanelButton.style.display = 'none'; // Directly hide the button
        });
    }

    // Initial adjustment of panel height
    adjustSidePanelHeight();
});

// Adjust panel height on window resize
window.addEventListener('resize', debounce(adjustSidePanelHeight, 150));

// --- Helper Function for Temperature Color Scale ---
function getTempColor(tempF) {
    if (tempF === undefined || tempF === null) return '#e0e0e0'; // Default color for missing data

    if (tempF < 32) return '#6495ED';    // Cornflower Blue (Very Cold)
    if (tempF < 50) return '#87CEEB';    // Sky Blue (Cold)
    if (tempF < 65) return '#ADD8E6';    // Light Blue (Cool)
    if (tempF <= 75) return '#f0f0f0';   // Light Grey (Comfortable)
    if (tempF <= 85) return '#FFD700';    // Gold (Warm)
    if (tempF <= 95) return '#FFA500';    // Orange (Hot)
    return '#FF4500';                   // OrangeRed (Very Hot)
}

// Function to fetch and display weather forecast
async function fetchWeatherForecast(latitude, longitude, locationNameHint = null) {
    // Target the new container for location-specific weather
    const locationWeatherContainer = document.getElementById('location-weather-display');
    const globalWeatherContainer = document.getElementById('global-weather-stats');
    
    // Show loading state in the specific container
    locationWeatherContainer.innerHTML = '<p>Loading weather...</p>'; 
    // Hide global stats when starting to load specific ones
    if (globalWeatherContainer) globalWeatherContainer.style.display = 'none'; 
    // Ensure the location container is visible (might be hidden on error previously)
    locationWeatherContainer.style.display = 'block';

    try {
        // First, fetch the API key from our backend
        const keyResponse = await fetch('/get-weather-key');
        if (!keyResponse.ok) {
            const errorData = await keyResponse.json();
            throw new Error(`Failed to get API key: ${keyResponse.status} - ${errorData.error || 'Server error'}`);
        }
        const keyData = await keyResponse.json();
        const apiKey = keyData.apiKey;

        if (!apiKey) {
            throw new Error('API key is missing from server response.');
        }

        // Using 5 Day / 3 Hour Forecast endpoint for broader free tier compatibility:
        const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=imperial`; // Use 'imperial' for Fahrenheit

        const weatherResponse = await fetch(apiUrl);
        if (!weatherResponse.ok) {
            // Handle HTTP errors (e.g., 401 Unauthorized, 404 Not Found)
            const errorData = await weatherResponse.json();
            throw new Error(`Weather API Error: ${weatherResponse.status} - ${errorData.message || 'Unknown error'}`);
        }
        const data = await weatherResponse.json();
        // Pass lat/lon and the name hint along with data
        await displayWeatherForecast(data, latitude, longitude, locationNameHint);

    } catch (error) {
        console.error('Failed to fetch weather forecast:', error);
        // Display error in the specific container
        locationWeatherContainer.innerHTML = `<p style="color: red;">Could not load weather forecast. ${error.message}</p>`;
        // Show global stats again on error? Or just leave the error? Let's leave the error.
        // if (globalWeatherContainer) globalWeatherContainer.style.display = 'block'; 
    }
}

// Function to process and display the 5-day forecast data
async function displayWeatherForecast(data, latitude, longitude, locationNameHint = null) {
    // Target the new container for location-specific weather
    const locationWeatherContainer = document.getElementById('location-weather-display');
    const globalWeatherContainer = document.getElementById('global-weather-stats');
    
    // Hide global stats as we are about to display specific ones
    if (globalWeatherContainer) globalWeatherContainer.style.display = 'none';
    // Ensure the location container is visible
    locationWeatherContainer.style.display = 'block';

    let locationName = locationNameHint || 'Weather Forecast'; // Use hint if available, otherwise default
    let needsReverseGeocode = !locationNameHint; // Only geocode if hint wasn't provided

    // Check if city name exists in OpenWeatherMap data AND if we didn't get a hint
    if (needsReverseGeocode && data.city && data.city.name) {
        locationName = data.city.name;
        needsReverseGeocode = false; // Found name from OWM, no need to geocode
    } 
    
    // Set the initial header in the specific container
    locationWeatherContainer.innerHTML = `<h2>5-Day Forecast - ${locationName}</h2>`; 

    // If we still need a name (no hint, no OWM name) and have coords, try reverse geocoding
    if (needsReverseGeocode && latitude !== undefined && longitude !== undefined) {
        locationName = 'Loading location...'; // Temporary name
        locationWeatherContainer.innerHTML = `<h2>5-Day Forecast - ${locationName}</h2>`; // Update header
        try {
            const geocodedName = await reverseGeocode(latitude, longitude);
            locationName = geocodedName; // Update name with result
             // Update the final header again after geocoding
            locationWeatherContainer.innerHTML = `<h2>5-Day Forecast - ${locationName}</h2>`; 
        } catch (error) { 
            // Error already logged in reverseGeocode, keep fallback from there
            locationName = `Area near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
             // Update the final header again with fallback
            locationWeatherContainer.innerHTML = `<h2>5-Day Forecast - ${locationName}</h2>`; 
        }
    } // else locationName remains the hint, OWM name, or the initial default

    // Ensure header is set correctly if we skipped geocoding but had a hint/OWM name
    if (locationWeatherContainer.querySelector('h2').textContent !== `5-Day Forecast - ${locationName}`) {
         locationWeatherContainer.innerHTML = `<h2>5-Day Forecast - ${locationName}</h2>`;
    }

    if (!data || !data.list) {
        // Append error message to the header already set
        locationWeatherContainer.innerHTML += '<p>No forecast data available.</p>';
        return;
    }

    // Process the 3-hour interval data to get daily summaries
    const dailyForecasts = {};
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        if (!dailyForecasts[date]) {
            dailyForecasts[date] = {
                temps: [],
                descriptions: {},
                icons: {},
                humidity: []
            };
        }
        dailyForecasts[date].temps.push(item.main.temp);
        dailyForecasts[date].humidity.push(item.main.humidity);

        // Store descriptions and icons counts to find the most frequent one for the day
        const desc = item.weather[0].description;
        const icon = item.weather[0].icon;
        dailyForecasts[date].descriptions[desc] = (dailyForecasts[date].descriptions[desc] || 0) + 1;
        dailyForecasts[date].icons[icon] = (dailyForecasts[date].icons[icon] || 0) + 1;
    });

    // Create HTML for each day
    Object.keys(dailyForecasts).slice(0, 5).forEach(date => { // Limit to 5 days
        const dayData = dailyForecasts[date];
        const maxTemp = Math.round(Math.max(...dayData.temps));
        const minTemp = Math.round(Math.min(...dayData.temps));
        const avgHumidity = Math.round(dayData.humidity.reduce((a, b) => a + b, 0) / dayData.humidity.length);

        // Find most frequent description and icon
        const mostFrequentDesc = Object.keys(dayData.descriptions).reduce((a, b) => dayData.descriptions[a] > dayData.descriptions[b] ? a : b);
        const mostFrequentIcon = Object.keys(dayData.icons).reduce((a, b) => dayData.icons[a] > dayData.icons[b] ? a : b);
        const iconUrl = `https://openweathermap.org/img/wn/${mostFrequentIcon}.png`;

        const maxTempColor = getTempColor(maxTemp);
        const minTempColor = getTempColor(minTemp);

        const dayElement = document.createElement('div');
        dayElement.classList.add('weather-day');
        // Format the temperature string with spans and colors
        dayElement.innerHTML = `
            <div class="weather-date">${date}</div>
            <img src="${iconUrl}" alt="${mostFrequentDesc}" class="weather-icon">
            <div class="weather-desc">${mostFrequentDesc}</div>
            <div class="weather-temp">
                H: <span style="color: ${maxTempColor}; font-weight: 600;">${maxTemp}°F</span> |
                L: <span style="color: ${minTempColor}; font-weight: 600;">${minTemp}°F</span>
            </div>
            <div class="weather-extra">${avgHumidity}%</div>
        `;
        locationWeatherContainer.appendChild(dayElement);
    });
}