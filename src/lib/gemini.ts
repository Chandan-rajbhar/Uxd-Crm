import { GoogleGenerativeAI } from "@google/generative-ai";
import { settingsService } from "@/firebase/settingsService";

let genAI: GoogleGenerativeAI | null = null;
let currentKey: string | null = null;

/**
 * Gets or initializes the GoogleGenerativeAI instance with the key from Firestore.
 */
async function getGenAI() {
    const key = await settingsService.getAiApiKey();
    
    if (!key) {
        throw new Error("AI API Key is not configured. Please contact an administrator to set it up in Settings > Admin.");
    }

    if (genAI && key === currentKey) {
        return genAI;
    }

    currentKey = key;
    genAI = new GoogleGenerativeAI(key);
    return genAI;
}

/**
 * Generates content using Google's Gemini AI models.
 * @param prompt The prompt string to send to the AI.
 * @param modelName The model to use. Defaults to "gemini-3.1-flash-lite-preview".
 * @param systemInstruction Optional system instruction to guide the model's behavior.
 * @returns The generated text response.
 */
export const generateAIContent = async (
    prompt: string, 
    modelName: string = "gemini-3.1-flash-lite-preview",
    systemInstruction?: string
) => {
    try {
        const ai = await getGenAI();
        console.log(`[AI] Using API Key: ${currentKey?.substring(0, 6)}...${currentKey?.substring(currentKey.length - 4)}`);
        
        const model = ai.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating AI content:", error);
        throw error;
    }
};

export { getGenAI };
