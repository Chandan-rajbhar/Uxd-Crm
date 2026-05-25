const axios = require('axios');
const apiKey = "AIzaSyDyB8mBN1Pki9jCnAj9zR6sfcDkTueVTAs";

async function test() {
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models"; 
    
    try {
        const response = await axios.get(`${apiUrl}?key=${apiKey}`);
        console.log("Models:", response.data.models.map(m => m.name).filter(n => n.includes('veo') || n.includes('video')));
    } catch(err) {
        console.error("Error", err.response?.data || err.message);
    }
}
test();
