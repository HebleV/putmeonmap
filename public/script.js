document.addEventListener('DOMContentLoaded', function() {
    // Initialize map with dark theme
    const map = L.map('map').setView([20, 0], 2); // Start with world view
    
    // Dark theme map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Try to get user's location, but don't worry if it fails
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 13);
            },
            error => {
                console.log('Geolocation not available, using default view');
                // Use a default location (New York City)
                map.setView([40.7128, -74.0060], 13);
            },
            { timeout: 5000 } // Only wait 5 seconds for location
        );
    } else {
        // Fallback for browsers that don't support geolocation
        map.setView([40.7128, -74.0060], 13); // New York City as default
    }
    
    let marker;
    
    // Add marker on map click
    map.on('click', function(e) {
        setMarkerAt(e.latlng.lat, e.latlng.lng);
        
        // Attempt to reverse geocode the location
        reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
    
    // Function to set marker at specific coordinates
    function setMarkerAt(lat, lng) {
        if (marker) {
            map.removeLayer(marker);
        }
        
        // Create custom marker with pulse effect
        marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div class="marker-pin"></div><div class="pulse"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(map);
        
        // Update form fields
        document.getElementById('lat').value = lat.toFixed(6);
        document.getElementById('lng').value = lng.toFixed(6);
        
        // Center map on marker
        map.setView([lat, lng], map.getZoom());
    }
    
    // Modify the address input to include a spinner container
    const addressInput = document.getElementById('address');
    const addressParent = addressInput.parentElement;
    
    // Create a wrapper for the input and spinner
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-wrapper';
    
    // Create the spinner element
    const searchSpinner = document.createElement('div');
    searchSpinner.className = 'input-spinner';
    searchSpinner.style.display = 'none'; // Hide by default
    
    // Move the input to the wrapper and add the spinner
    addressParent.removeChild(addressInput);
    inputWrapper.appendChild(addressInput);
    inputWrapper.appendChild(searchSpinner);
    addressParent.appendChild(inputWrapper);
    
    // Geocoding function - convert address to coordinates
    function geocodeAddress(address) {
        const geocodingUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        
        // Show the search spinner
        searchSpinner.style.display = 'block';
        
        fetch(geocodingUrl)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const { lat, lon } = data[0];
                    
                    // Set marker and center map
                    setMarkerAt(parseFloat(lat), parseFloat(lon));
                    map.setView([lat, lon], 16);
                } else {
                    showError('Location not found. Try a different address or drop a pin manually.');
                }
            })
            .catch(error => {
                console.error('Geocoding error:', error);
                showError('Failed to locate address. Please try again or drop a pin manually.');
            })
            .finally(() => {
                // Hide the search spinner
                searchSpinner.style.display = 'none';
            });
    }
    
    // Reverse geocoding - get address from coordinates
    function reverseGeocode(lat, lng) {
        const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        
        fetch(reverseUrl)
            .then(response => response.json())
            .then(data => {
                if (data && data.display_name) {
                    document.getElementById('address').value = data.display_name;
                }
            })
            .catch(error => {
                console.error('Reverse geocoding error:', error);
            });
    }
    
    // Add event listener to address input for geocoding
    let typingTimer;
    
    addressInput.addEventListener('input', function() {
        clearTimeout(typingTimer);
        
        // Only geocode if there's text in the input
        if (addressInput.value) {
            // Wait for user to stop typing before geocoding
            typingTimer = setTimeout(() => {
                geocodeAddress(addressInput.value);
            }, 1000);
        }
    });
    
    // Handle form submission
    const form = document.getElementById('submitForm');
    const submitButton = document.getElementById('submitButton');
    const submitSpinner = document.getElementById('submitSpinner');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    // Hide messages initially
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate form
        const name = document.getElementById('name').value;
        const address = document.getElementById('address').value;
        const lat = document.getElementById('lat').value;
        const lng = document.getElementById('lng').value;
        const category = document.getElementById('category').value;
        
        if (!name || !address || !lat || !lng || !category) {
            showError('Please fill all fields and drop a pin on the map.');
            return;
        }
        
        // Show loading state
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitSpinner.style.display = 'block';
        
        console.log('Submitting data:', { name, address, lat, lng, category });
        
        // Submit to backend
        fetch('/submit-to-google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                address,
                lat,
                lng,
                category
            })
        })
        .then(response => {
            console.log('Response status:', response.status);
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Something went wrong');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Success response:', data);
            // Reset form
            form.reset();
            if (marker) {
                map.removeLayer(marker);
                marker = null;
            }
            
            // Show success message
            showSuccess();
        })
        .catch(error => {
            console.error('Submission error:', error);
            showError(error.message || 'Failed to submit. Please try again.');
        })
        .finally(() => {
            // Reset button state
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitSpinner.style.display = 'none';
        });
    });
    
    // Add Enter key handler for address field
    addressInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            if (addressInput.value) {
                geocodeAddress(addressInput.value);
            }
        }
    });
    
    function showSuccess() {
        successMessage.style.display = 'flex';
        errorMessage.style.display = 'none';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 5000);
    }
    
    function showError(message) {
        errorText.textContent = message;
        errorMessage.style.display = 'flex';
        successMessage.style.display = 'none';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
});