import { jsPDF } from "jspdf";
import type { Candidate, OfferConfig } from "@/firebase/candidateService";

const replacePlaceholders = (text: string, candidate: Candidate, config: OfferConfig, effectiveDate: string, newSalary: string) => {
    if (!text) return "";
    return text
        .replace(/{name}/g, candidate.name)
        .replace(/{position}/g, candidate.position)
        .replace(/{joiningDate}/g, candidate.joiningDate ? new Date(candidate.joiningDate).toLocaleDateString('en-GB') : "TBA")
        .replace(/{effectiveDate}/g, effectiveDate ? new Date(effectiveDate).toLocaleDateString('en-GB') : "TBA")
        .replace(/{salary}/g, newSalary || candidate.offeredSalary || "TBA")
        .replace(/{companyName}/g, config.companyName);
};

export const generateAmendmentLetterPDF = (
    candidate: Candidate, 
    config: OfferConfig, 
    effectiveDate: string, 
    newSalary: string, 
    type: "Full Time" | "Internship" | "Internship (Paid)" = "Internship",
    employeeSignature?: {
        image: string;
        date: string;
        time: string;
    }
) => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const primaryColor = [232, 60, 145]; // #E83C91
    const secondaryColor = [30, 41, 59]; // Slate-800
    const lightGray = [148, 163, 184]; // Slate-400
    const textGray = [71, 85, 105]; // Slate-600

    const TITLE_SIZE = 14;
    const BODY_SIZE = 10;
    const SMALL_SIZE = 9;

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
    
    let yPos = 50;

    // Title based on type
    const titleText = type === "Full Time" ? "Promotion to Full-Time Employment" : "Amendment to Internship Offer Letter";
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(titleText, 105, yPos, { align: "center" });
    
    // Underline
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineWidth(0.3);
    const titleWidth = doc.getTextWidth(titleText);
    doc.line(105 - (titleWidth / 2), yPos + 1, 105 + (titleWidth / 2), yPos + 1);
    
    yPos += 15;

    // Date
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text(todayStr, 190, yPos, { align: "right" });
    
    yPos += 20;

    // Salutation
    doc.setFont("helvetica", "normal");
    doc.text(`Dear ${candidate.name.split(' ')[0]},`, 20, yPos);
    
    yPos += 12;

    // Body Template based on type
    let bodyTemplate = config.amendmentLetterBody;
    
    if (type === "Full Time") {
        bodyTemplate = "We are pleased to inform you that, effective from {effectiveDate}, your internship role with {companyName} will transition to Full-Time Employment as a {position} with an annual CTC of {salary}.\n\nWith this promotion, you will be assigned new roles and responsibilities, which you need to adhere to. This achievement has been received by you over a period of time and with hard work and dedication towards work. We hope you continue to work with the same dedication for your new position in the future.";
    } else if (!bodyTemplate) {
        bodyTemplate = "We are pleased to inform you that, effective from {effectiveDate}, your internship role with {companyName} will transition from an unpaid position to a paid internship of {salary} per month.";
    }
    
    const bodyText = replacePlaceholders(bodyTemplate, candidate, config, effectiveDate, newSalary);
    
    const splitBody = doc.splitTextToSize(bodyText, 170);
    doc.text(splitBody, 20, yPos, { lineHeightFactor: 1.5 });
    
    yPos += (splitBody.length * 7) + 15;

    // Closing
    doc.text("Sincerely,", 20, yPos);
    
    yPos += 45; // Space for signature

    // Signatures Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    
    // Left: HR
    doc.text(config.hrName, 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(SMALL_SIZE);
    doc.text(config.hrDesignation, 20, yPos + 5);
    
    // Right: Employee
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text(candidate.name, 190, yPos, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(SMALL_SIZE);
    doc.text("Employee Acceptance", 190, yPos + 5, { align: "right" });

    // HR Signature (Optional)
    if (config.signatureUrl) {
        try {
            doc.addImage(config.signatureUrl, 'PNG', 20, yPos - 35, 40, 18);
        } catch (e) {
            console.error("Failed to add signature to amendment letter:", e);
        }
    }

    // Employee Signature (Optional)
    if (employeeSignature) {
        try {
            const sigWidth = 45;
            const sigHeight = 18;
            
            // Clear signature area with white background for a clean look
            doc.setFillColor(255, 255, 255);
            doc.rect(140, yPos - 25, 60, 35, 'F');

            // Add the signature image
            doc.addImage(employeeSignature.image, 'PNG', 190 - sigWidth, yPos - 18, sigWidth, sigHeight);
            
            // Metadata Verification
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.setFont("helvetica", "bold");
            doc.text(`DIGITALLY SIGNED & VERIFIED`, 190, yPos + 10, { align: "right" });
            
            doc.setFont("helvetica", "normal");
            doc.text(`Signed by: ${candidate.name}`, 190, yPos + 13, { align: "right" });
            doc.text(`Timestamp: ${employeeSignature.date} ${employeeSignature.time}`, 190, yPos + 16, { align: "right" });
            doc.text(`Status: Verified & Legally Binding`, 190, yPos + 19, { align: "right" });
        } catch (e) {
            console.error("Failed to add employee signature:", e);
        }
    }

    return doc;
};
