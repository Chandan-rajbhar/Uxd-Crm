const axios = require('axios');
const apiKey = "AIzaSyDyB8mBN1Pki9jCnAj9zR6sfcDkTueVTAs";

async function test() {
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning"; 
    // try veo-2.0-generate-001
    try {
        const response = await axios.post(`${apiUrl}?key=${apiKey}`, {
            instances: [
                { prompt: "A futuristic city in the clouds" }
            ],
            parameters: { aspectRatio: "9:16" }
        });
        console.log("Operation started:", response.data);
    } catch(err) {
        console.error("Error", err.response?.data || err.message);
    }
}
test();
