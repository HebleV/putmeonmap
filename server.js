const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const config = require('./config');

const app = express();
const PORT = config.port;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create screenshots directory if it doesn't exist
const submissionsDir = path.join(__dirname, 'submissions');
if (!fs.existsSync(submissionsDir)) {
    fs.mkdirSync(submissionsDir);
}

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to submit to Google Maps
app.post('/submit-to-google', async (req, res) => {
    console.log('Received submission request:', req.body);
    
    const { name, address, lat, lng, category } = req.body;
    
    // Validate data
    if (!name || !address || !lat || !lng || !category) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    try {
        // Log the submission
        const submissionId = logSubmission(req.body);
        
        // Check if we're in development mode and should use mock response
        if (config.mode === 'development' && config.useMockInDevelopment) {
            console.log('Using mock response in development mode');
            
            // Return a mock success response
            return res.status(200).json({
                success: true,
                message: 'Location submitted successfully (MOCK)',
                submissionId,
                mockMode: true
            });
        }
        
        // Submit to Google Maps API
        const result = await submitToGoogleMapsAPI(req.body);
        
        res.status(200).json({
            success: true,
            message: 'Location submitted successfully to Google Maps',
            submissionId,
            result
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: 'Failed to submit location to Google Maps',
            details: error.message
        });
    }
});

// Function to log submissions to a file
function logSubmission(data) {
    const submissionId = Date.now();
    const logPath = path.join(submissionsDir, `${submissionId}.json`);
    
    const submission = {
        ...data,
        id: submissionId,
        timestamp: new Date().toISOString()
    };
    
    try {
        fs.writeFileSync(logPath, JSON.stringify(submission, null, 2));
        console.log(`Submission logged to file: ${logPath}`);
        
        // Also update the all-submissions file
        updateAllSubmissions(submission);
        
        return submissionId;
    } catch (error) {
        console.error('Error writing to submission file:', error);
        throw new Error('Failed to log submission');
    }
}

// Update the all-submissions file
function updateAllSubmissions(submission) {
    const allSubmissionsPath = path.join(submissionsDir, 'all-submissions.json');
    
    let submissions = [];
    if (fs.existsSync(allSubmissionsPath)) {
        try {
            const fileData = fs.readFileSync(allSubmissionsPath, 'utf8');
            submissions = JSON.parse(fileData);
        } catch (error) {
            console.error('Error reading all-submissions file:', error);
            // Continue with empty array if file is corrupted
        }
    }
    
    submissions.push(submission);
    
    try {
        fs.writeFileSync(allSubmissionsPath, JSON.stringify(submissions, null, 2));
        console.log('All-submissions file updated');
    } catch (error) {
        console.error('Error writing to all-submissions file:', error);
    }
}

// Function to submit to Google Maps API
async function submitToGoogleMapsAPI(data) {
    const { name, address, lat, lng, category } = data;
    
    console.log('Submitting to Google Maps API...');
    
    try {
        // Use Google Places API to add a place
        // Documentation: https://developers.google.com/maps/documentation/places/web-service/add-place
        const response = await axios.post(
            `https://maps.googleapis.com/maps/api/place/add/json?key=${config.googleMapsApiKey}`,
            {
                location: {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng)
                },
                accuracy: 50, // accuracy of the location in meters
                name: name,
                address: address,
                types: [mapCategoryToGoogleType(category)],
                language: "en"
            }
        );
        
        console.log('Google Maps API response:', response.data);
        
        // Log the API response
        const responseLogPath = path.join(submissionsDir, `api-response-${Date.now()}.json`);
        fs.writeFileSync(responseLogPath, JSON.stringify(response.data, null, 2));
        
        return {
            status: 'success',
            placeId: response.data.place_id,
            apiResponse: response.data
        };
    } catch (error) {
        console.error('Google Maps API error:', error.response?.data || error.message);
        
        // Log the error
        const errorLogPath = path.join(submissionsDir, `api-error-${Date.now()}.json`);
        fs.writeFileSync(errorLogPath, JSON.stringify({
            error: error.message,
            response: error.response?.data,
            timestamp: new Date().toISOString()
        }, null, 2));
        
        throw new Error(`Google Maps API error: ${error.response?.data?.error_message || error.message}`);
    }
}

// Map our categories to Google Place types
function mapCategoryToGoogleType(category) {
    const mapping = {
        'business': 'establishment',
        'restaurant': 'restaurant',
        'shop': 'store',
        'landmark': 'point_of_interest',
        'home': 'home_goods_store', // closest match
        'other': 'establishment'
    };
    
    return mapping[category] || 'establishment';
}

// API endpoint to view submissions
app.get('/submissions', (req, res) => {
    const allSubmissionsPath = path.join(submissionsDir, 'all-submissions.json');
    
    if (!fs.existsSync(allSubmissionsPath)) {
        return res.json([]);
    }
    
    try {
        const fileData = fs.readFileSync(allSubmissionsPath, 'utf8');
        const submissions = JSON.parse(fileData);
        res.json(submissions);
    } catch (error) {
        console.error('Error reading submissions file:', error);
        res.status(500).json({ error: 'Failed to read submissions' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running in ${config.mode} mode on port ${PORT}`);
    console.log(`Server is available at http://localhost:${PORT}`);
    console.log(`View submissions at http://localhost:${PORT}/submissions`);
    if (config.mode === 'development' && config.useMockInDevelopment) {
        console.log('Using mock responses for Google Maps API in development mode');
    }
});