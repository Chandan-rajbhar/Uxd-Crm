import { getFunctions, httpsCallable } from "firebase/functions";

export const whatsappService = {
    /**
     * Send a WhatsApp message to a lead
     * @param to - Phone number with country code (e.g., "+919876543210")
     * @param message - Text message to send
     * @param leadId - Firestore lead document ID (for logging)
     * @param leadName - Name of the lead (for reference)
     */
    sendMessageToLead: async (data: {
        to: string;
        message: string;
        leadId?: string;
        leadName?: string;
        templateName?: string;
        templateLanguage?: string;
        templateComponents?: any[];
    }) => {
        try {
            const functions = getFunctions();
            const sendFn = httpsCallable(functions, 'sendWhatsAppMessage');
            const result = await sendFn(data);
            return result.data as { success: boolean; messageId: string };
        } catch (error) {
            console.error("Error sending WhatsApp to lead:", error);
            throw error;
        }
    },

    /**
     * Send a WhatsApp project update to a client
     * @param to - Client phone number with country code
     * @param message - Update message text
     * @param projectId - Project document ID
     * @param projectName - Project name
     * @param clientName - Client name
     * @param clientId - Client document ID
     */
    sendProjectUpdate: async (data: {
        to: string;
        message: string;
        projectId?: string;
        projectName?: string;
        clientName?: string;
        clientId?: string;
    }) => {
        try {
            const functions = getFunctions();
            const sendFn = httpsCallable(functions, 'sendWhatsAppProjectUpdate');
            const result = await sendFn(data);
            return result.data as { success: boolean; messageId: string };
        } catch (error) {
            console.error("Error sending WhatsApp project update:", error);
            throw error;
        }
    }
};
