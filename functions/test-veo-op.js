const axios = require('axios');
const apiKey = "AIzaSyDyB8mBN1Pki9jCnAj9zR6sfcDkTueVTAs";

async function test() {
    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001/operations/4n2qls902sou?key=${apiKey}`);
        console.log("Operation:", JSON.stringify(response.data, null, 2));
    } catch(err) {
        console.error("Error", err.response?.data || err.message);
    }
}
test();
