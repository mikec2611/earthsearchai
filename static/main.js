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

    $('#marker_' + markerId).addClass('active_marker');
    $('#marker_button_' + markerId).addClass('active_marker');
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
        fetchWeatherForecast(latitude, longitude); 
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

// let debounceTimerInfo;
// $('.info_button').on('click', function(e) {
//     let detail_topic = $(this).text();
//     clearTimeout(debounceTimerInfo);
//     document.getElementById('loadingIndicator').style.display = 'block';
//     debounceTimerInfo = setTimeout(() => {
//         $.ajax({
//             url: '/coordinates',
//             type: 'POST',
//             contentType: 'application/json',
//             data: JSON.stringify({ 'lat': 'detail', 
//                                     'lng': 'detail', 
//                                     'prompt_type': 'detail',  
//                                     'detail_topic': detail_topic 
//                                 }),
//             success: function(response) {
//                 // content = response.content
//                 // let parser = new DOMParser();
//                 // let doc = parser.parseFromString(content, "text/html");
//                 // let locationTitle = doc.querySelector('h1').textContent; // Extract the text content of the <h1> tag
                
//                 document.getElementById('loadingIndicator').style.display = 'none';
//             },
//             error: function(error) {
//                 console.log(error);
//                 document.getElementById('loadingIndicator').style.display = 'none';
//             }
//         });
//     }, 500);
// });


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
    return new Promise((resolve, reject) => {
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
            return;
        }

        $.ajax({
            url: '/coordinates',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 
                'lat': lngLat.lat, 
                'lng': lngLat.lng, 
                'prompt_type': 'general',  
                'detail_topic': 'general', 
                'nearby_features': nearbyFeatureNames // Add nearby features to the payload
            }),
            success: function(response) {
                let parser = new DOMParser();
                main_content = response.main_content
                let reponse_main_content = parser.parseFromString(main_content, "text/html");
                video_content = response.video_content
                let loc_name = response.loc_name // Get loc_name from response
                
                // set marker
                let h1Element = reponse_main_content.querySelector('h1');
                let location_title;
                if (h1Element && h1Element.textContent.trim()) {
                    location_title = h1Element.textContent.trim();
                } else {
                    // Fallback to loc_name if H1 is missing or empty
                    location_title = loc_name ? loc_name : 'Unknown Location'; 
                }
                
                clickCounter = addMarkerAtClick(lngLat, main_content, location_title);
                addButtonForMarker(clickCounter, location_title, lngLat.lng, lngLat.lat, video_content);
                highlight_active_marker(clickCounter)

                // video embed;
                embed_loc_video(video_content)
                
                // display main_content
                displayInfoInPanel(main_content)

                // Fetch weather for the clicked location
                fetchWeatherForecast(lngLat.lat, lngLat.lng);
                
                // searchCount++;
                // if (searchCount === 3) {
                //     const buyMeACoffee = document.getElementById('buyMeACoffee');
                //     const promptMessage = document.getElementById('promptMessage');
                    
                //     buyMeACoffee.classList.add('centered');
                //     promptMessage.style.display = 'block';
                // }

                resolve('Location processed successfully');
            },
            error: function(error) {
                console.log(error);
                reject('Error processing location');
            }
        });
    });
}

// document.getElementById('noButton').addEventListener('click', function() {
//     const buyMeACoffee = document.getElementById('buyMeACoffee');
//     const promptMessage = document.getElementById('promptMessage');
    
//     buyMeACoffee.classList.remove('centered');
//     promptMessage.style.display = 'none';
//     searchCount = 0; // Reset the search count
// });

// document.getElementById('yesButton').addEventListener('click', function() {
//     window.open('https://www.buymeacoffee.com/mikec2611', '_blank');
//     buyMeACoffee.classList.remove('centered');
//     promptMessage.style.display = 'none';
//     searchCount = 0; // Reset the search count
// });



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

// Function to fetch and display weather forecast
async function fetchWeatherForecast(latitude, longitude) {
    const weatherContainer = document.getElementById('weather-forecast');
    weatherContainer.innerHTML = '<p>Loading weather...</p>'; // Show loading state

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
        // Pass lat/lon along with data
        await displayWeatherForecast(data, latitude, longitude);

    } catch (error) {
        console.error('Failed to fetch weather forecast:', error);
        weatherContainer.innerHTML = `<p style="color: red;">Could not load weather forecast. ${error.message}</p>`;
        // Optionally, add a retry button or specific instructions
    }
}

// Function to process and display the 5-day forecast data
async function displayWeatherForecast(data, latitude, longitude) {
    const weatherContainer = document.getElementById('weather-forecast');
    
    let locationName = 'Weather Forecast'; // Default fallback
    
    // Check if city name exists in OpenWeatherMap data
    if (data.city && data.city.name) {
        locationName = data.city.name;
    } else if (latitude !== undefined && longitude !== undefined) {
        // If no name, try reverse geocoding
        locationName = 'Loading location...'; // Temporary name
        // Update the header immediately with loading state
        weatherContainer.innerHTML = `<h2>5-Day Forecast - ${locationName}</h2>`; 
        try {
            const geocodedName = await reverseGeocode(latitude, longitude);
            locationName = geocodedName; // Update name with result
        } catch (error) { 
            // Error already logged in reverseGeocode, keep fallback from there
            locationName = `Area near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        }
    } // else, keep the default 'Weather Forecast' if coordinates are also missing

    // Set the final header (or update if reverse geocoding was used)
    weatherContainer.innerHTML = `<h2>5-Day Forecast - ${locationName}</h2>`; 

    if (!data || !data.list) {
        weatherContainer.innerHTML += '<p>No forecast data available.</p>';
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
                humidity: [],
                wind: []
            };
        }
        dailyForecasts[date].temps.push(item.main.temp);
        dailyForecasts[date].humidity.push(item.main.humidity);
        dailyForecasts[date].wind.push(item.wind.speed);

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
        const avgWind = (dayData.wind.reduce((a, b) => a + b, 0) / dayData.wind.length).toFixed(1);

        // Find most frequent description and icon
        const mostFrequentDesc = Object.keys(dayData.descriptions).reduce((a, b) => dayData.descriptions[a] > dayData.descriptions[b] ? a : b);
        const mostFrequentIcon = Object.keys(dayData.icons).reduce((a, b) => dayData.icons[a] > dayData.icons[b] ? a : b);
        const iconUrl = `https://openweathermap.org/img/wn/${mostFrequentIcon}.png`;

        const dayElement = document.createElement('div');
        dayElement.classList.add('weather-day');
        dayElement.innerHTML = `
            <div class="weather-date">${date}</div>
            <img src="${iconUrl}" alt="${mostFrequentDesc}" class="weather-icon">
            <div class="weather-temp">${maxTemp}°F / ${minTemp}°F</div>
            <div class="weather-desc">${mostFrequentDesc}</div>
            <div class="weather-extra">Humidity: ${avgHumidity}%</div>
            <div class="weather-extra">Wind: ${avgWind} m/s</div>
        `;
        weatherContainer.appendChild(dayElement);
    });
}