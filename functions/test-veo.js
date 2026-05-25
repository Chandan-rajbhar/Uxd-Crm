const axios = require('axios');
const apiKey = "AIzaSyDyB8mBN1Pki9jCnAj9zR6sfcDkTueVTAs";

async function test() {
    console.log("Starting test...");
    const prompt = "A futuristic city in the clouds";
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-preview:predictLongRunning"; 
    
    try {
        const response = await axios.post(`${apiUrl}?key=${apiKey}`, {
            instances: [
                { prompt: prompt }
            ],
            parameters: { aspectRatio: "9:16" }
        });
        console.log("Operation started:", response.data);
    } catch(err) {
        console.error("Error starting operation", err.response?.data || err.message);
    }
}
test();
