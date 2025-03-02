// Configuration file for API keys and environment settings
module.exports = {
    // Google Maps API key - replace with your actual API key for production
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || 'your-api-key-here',
    
    // Environment mode - 'development' or 'production'
    mode: process.env.NODE_ENV || 'development',
    
    // Server port
    port: process.env.PORT || 3000,
    
    // Whether to use mock responses in development mode
    useMockInDevelopment: true
}; 