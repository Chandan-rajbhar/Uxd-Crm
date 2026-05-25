
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDyB8mBN1Pki9jCnAj9zR6sfcDkTueVTAs";

async function checkModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        console.log("API Response Status:", response.status);
        if (data.error) {
            console.error("API Error:", data.error);
        } else {
            console.log("Available Models:");
            const models = data.models || [];
            models.forEach(m => console.log(`- ${m.name}`));
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

checkModels();
