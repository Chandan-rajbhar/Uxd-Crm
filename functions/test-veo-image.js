const axios = require('axios');
const apiKey = "AIzaSyDyB8mBN1Pki9jCnAj9zR6sfcDkTueVTAs";

async function test() {
    try {
        const imgResp = await axios.get("https://picsum.photos/200/300", { responseType: 'arraybuffer' });
        const imgB64 = Buffer.from(imgResp.data).toString('base64');
        const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning";
        const payloadInline = {
            instances: [{ 
                prompt: "A beautiful cat sleeping", 
                image: { bytesBase64Encoded: imgB64, mimeType: "image/jpeg" } 
            }]
        };
        const response = await axios.post(`${apiUrl}?key=${apiKey}`, payloadInline);
        console.log("Operation:", JSON.stringify(response.data, null, 2));
    } catch(err) {
        if(err.response) {
            console.error("Error payload inline:", JSON.stringify(err.response.data, null, 2));
        }
    }
}
test();
