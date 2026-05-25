import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

export const extractTextFromResume = async (url: string): Promise<string> => {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
        let arrayBuffer: ArrayBuffer;

        // Use the storage-proxy to bypass CORS in development
        if (url.includes('firebasestorage.googleapis.com')) {
            const pathPart = url.split('firebasestorage.googleapis.com')[1];
            const proxyUrl = `/storage-proxy${pathPart}`;
            const response = await fetch(proxyUrl);
            arrayBuffer = await response.arrayBuffer();
        } else {
            const response = await fetch(url);
            arrayBuffer = await response.arrayBuffer();
        }

        if (url.toLowerCase().includes('.pdf')) {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += pageText + '\n';
            }
            return fullText;
        } else if (url.toLowerCase().includes('.docx') || url.toLowerCase().includes('.doc')) {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        }
        
        return "Unsupported file type for text extraction.";
    } catch (error) {
        console.error("Error extracting text from resume:", error);
        throw new Error("Failed to parse resume content.");
    }
};
