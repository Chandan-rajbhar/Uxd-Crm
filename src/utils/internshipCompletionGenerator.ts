import { jsPDF } from "jspdf";
import type { Candidate, OfferConfig } from "@/firebase/candidateService";

const replacePlaceholders = (text: string, candidate: Candidate, config: OfferConfig, internshipEndDate: string) => {
    if (!text) return "";
    return text
        .replace(/{name}/g, candidate.name)
        .replace(/{position}/g, candidate.position)
        .replace(/{joiningDate}/g, candidate.joiningDate ? new Date(candidate.joiningDate).toLocaleDateString('en-GB') : "TBA")
        .replace(/{internshipEndDate}/g, internshipEndDate ? new Date(internshipEndDate).toLocaleDateString('en-GB') : "TBA")
        .replace(/{salary}/g, candidate.offeredSalary || "As per agreed terms")
        .replace(/{companyName}/g, config.companyName);
};

export const generateInternshipCompletionPDF = (candidate: Candidate, config: OfferConfig, internshipEndDate: string) => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const primaryColor = [232, 60, 145]; // #E83C91
    const secondaryColor = [30, 41, 59]; // Slate-800
    const lightGray = [148, 163, 184]; // Slate-400
    const textGray = [71, 85, 105]; // Slate-600

    const TITLE_SIZE = 18;
    const BODY_SIZE = 10;

    const addHeader = () => {
        if (config.logoUrl) {
            try {
                doc.addImage(config.logoUrl, 'PNG', 20, 12, 35, 10, undefined, 'FAST');
            } catch (e) {
                console.error("Failed to add logo to PDF:", e);
                drawDefaultLogo();
            }
        } else {
            drawDefaultLogo();
        }

        doc.setFontSize(8);
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.text("9th Floor, A-27, Block A, Industrial Area,", 190, 15, { align: "right" });
        doc.text("Sector 62, Noida, Uttar Pradesh 201309", 190, 19, { align: "right" });
        
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.5);
        doc.line(20, 30, 190, 30);
    };

    const drawDefaultLogo = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text("u", 20, 20);
        doc.text("x", 25.5, 20);
        doc.text("dlab", 31, 20);
        
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.circle(27.3, 14, 0.8, "F");
        
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.text("humanizing technology", 20, 23);
    };

    addHeader();
    
    let yPos = 60;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("Internship Completion Certificate", 105, yPos, { align: "center" });
    
    // Title Underline
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(70, yPos + 1.5, 140, yPos + 1.5);
    
    yPos += 20;

    // Date
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Date: ${todayStr}`, 20, yPos);
    
    yPos += 12;

    // Salutation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text("TO WHOMSOEVER IT MAY CONCERN", 20, yPos);
    
    yPos += 12;

    // Body Text
    doc.setFont("helvetica", "normal");
    const bodyTemplate = config.internshipCompletionBody || "This is to certify that {name}, has successfully completed their internship as a {position} at {companyName} from {joiningDate} to {internshipEndDate}.";
    const bodyText = replacePlaceholders(bodyTemplate, candidate, config, internshipEndDate);
    
    const splitBody = doc.splitTextToSize(bodyText, 170);
    doc.text(splitBody, 20, yPos, { lineHeightFactor: 1.5 });
    
    yPos += (splitBody.length * 7) + 20;

    // Closing
    doc.setFont("helvetica", "bold");
    doc.text("Sincerely,", 20, yPos);
    yPos += 6;

    // Signatory Name
    doc.text(config.hrName, 20, yPos);
    yPos += 5;

    // Signatory Title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.text(config.hrDesignation, 20, yPos);
    yPos += 5;

    // Company Name
    doc.setFont("helvetica", "bold");
    doc.text(config.companyName, 20, yPos);

    // HR Signature (Optional)
    if (config.signatureUrl) {
        try {
            // Place signature above the name
            doc.addImage(config.signatureUrl, 'PNG', 20, yPos - 35, 40, 18);
        } catch (e) {
            console.error("Failed to add signature to completion certificate:", e);
        }
    }

    return doc;
};
