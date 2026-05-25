/**
 * Generate a professional HTML email template for UXDLab daily updates
 */
export function generateEmailTemplate({
    projectName,
    clientName,
    summary,
    date,
    credentials,
}: {
    projectName: string
    clientName: string
    summary: string
    date: string
    credentials?: any[]
}): string {
    // Strip any accidental "Subject: ..." line at the start
    let cleanSummary = summary.replace(/^(Subject|SUBJECT):\s*.*\n?/i, '').trim();

    // Check if content is already HTML (from Quill Editor or AI)
    const isHtml = /<[a-z][\s\S]*>/i.test(cleanSummary);
    
    let formattedSummary = '';
    
    if (isHtml) {
        formattedSummary = cleanSummary;
    } else {
        // Enhanced formatter: handles multi-line bullet points and numbered lists
        const lines = cleanSummary.split('\n');
        let htmlResult = '';
        let inList = false;
        let listCounter = 0;
        let currentStatus = 'Completed'; // Default status assuming top-down flow

        lines.forEach((line) => {
            const trimmedLine = line.trim();
            const upperLine = trimmedLine.toUpperCase();
            
            // Update current section status based on headers
            if (upperLine.includes('COMPLETED')) currentStatus = 'Completed';
            else if (upperLine.includes('PROGRESS') || upperLine.includes('WORKING')) currentStatus = 'In Progress';
            else if (upperLine.includes('PENDING')) currentStatus = 'Pending';

            const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•');
            const isNumbered = /^\d+\./.test(trimmedLine);
            const isHeader = upperLine === 'COMPLETED' || upperLine === 'IN PROGRESS' || upperLine === 'PENDING' || upperLine.endsWith(':') && (upperLine.includes('COMPLETED') || upperLine.includes('PROGRESS') || upperLine.includes('PENDING'));

            if (isHeader) {
                if (inList) {
                    htmlResult += `</div>`;
                    inList = false;
                }
                htmlResult += `<h3 style="margin: 24px 0 12px 0; color: #111827; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px;">${trimmedLine}</h3>`;
            } else if (isBullet || isNumbered) {
                if (!inList) {
                    htmlResult += `<div style="margin: 16px 0; padding: 0;">`;
                    inList = true;
                    listCounter = 0;
                }
                listCounter++;
                const cleanItem = trimmedLine.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '');
                
                // Minimal status-specific marker (colored bullet points)
                let marker = `<span style="color: #2563eb; margin-right: 10px; font-weight: bold; font-size: 20px; line-height: 1; display: inline-block; width: 20px; text-align: center;">•</span>`; // Blue for Pending/Default
                
                if (isNumbered) {
                    marker = `<span style="background-color: #2563eb; color: #ffffff; width: 22px; height: 22px; min-width: 22px; border-radius: 50%; display: inline-block; text-align: center; font-size: 11px; line-height: 22px; margin-right: 10px; font-weight: 800; font-family: sans-serif;">${listCounter}</span>`;
                } else if (currentStatus === 'Completed') {
                    marker = `<span style="color: #10b981; margin-right: 10px; font-weight: bold; font-size: 24px; line-height: 1; display: inline-block; width: 20px; text-align: center;">•</span>`; // Green
                } else if (currentStatus === 'In Progress') {
                    marker = `<span style="color: #f59e0b; margin-right: 10px; font-weight: bold; font-size: 24px; line-height: 1; display: inline-block; width: 20px; text-align: center;">•</span>`; // Yellow
                }
                
                // Detect "Heading: Description" pattern
                let displayContent = `<span style="color: #374151; line-height: 1.5; font-size: 15px;">${cleanItem}</span>`;
                if (cleanItem.includes(':')) {
                    const colonIndex = cleanItem.indexOf(':');
                    const heading = cleanItem.substring(0, colonIndex).trim();
                    const description = cleanItem.substring(colonIndex + 1).trim();
                    
                    if (description.length > 0) {
                        displayContent = `
                            <div style="flex: 1;">
                                <strong style="color: #111827; display: block; margin-bottom: 2px; font-size: 15px;">${heading}</strong>
                                <div style="color: #64748b; font-size: 13px; line-height: 1.4;">${description}</div>
                            </div>`;
                    }
                }

                htmlResult += `
                    <div style="margin-bottom: 12px; display: flex; align-items: flex-start;">
                        ${marker}
                        ${displayContent}
                    </div>`;
            } else if (trimmedLine === '') {
                if (inList) {
                    htmlResult += `</div>`;
                    inList = false;
                }
            } else {
                if (inList) {
                    // Stop aggressive merging - treat as new paragraph instead of appending to bullet
                    htmlResult += `</div>`;
                    inList = false;
                }
                // Convert plain text newlines to paragraphs if not in a list
                htmlResult += `<p style="margin: 12px 0; color: #374151; line-height: 1.6; font-size: 15px;">${trimmedLine}</p>`;
            }
        });

        if (inList) htmlResult += `</div>`;
        formattedSummary = htmlResult;
    }


    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Update - ${projectName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
    
    <!-- Main Content -->
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px;">
                
                <!-- Greeting -->
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${date}
                </p>
                <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #111827; line-height: 1.3;">
                    Hello${clientName ? ` ${clientName}` : ''},
                </h1>
                
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                    Here's your latest progress update for <strong style="color: #111827;">${projectName}</strong>.
                </p>

                <!-- Divider -->
                <div style="height: 1px; background-color: #e5e7eb; margin: 0 0 32px 0;"></div>

                <!-- Summary -->
                <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #111827;">
                    Progress Summary
                </h2>
                
                <div style="font-size: 15px; line-height: 1.7;">
                    ${formattedSummary}
                </div>

                ${credentials && credentials.length > 0 ? `
                <!-- Project Access -->
                <div style="margin-top: 40px; padding: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                        🔐 Project Access Credentials
                    </h3>
                    <div style="space-y: 12px;">
                        ${credentials.map((cred, i) => `
                        <div style="margin-bottom: ${i === credentials.length - 1 ? '0' : '20px'}; padding-bottom: ${i === credentials.length - 1 ? '0' : '20px'}; border-bottom: ${i === credentials.length - 1 ? 'none' : '1px dashed #e2e8f0'};">
                            <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1e40af;">${cred.name || 'Login Credentials'}</p>
                            ${cred.url ? `<p style="margin: 0 0 4px 0; font-size: 13px; color: #374151;"><strong>URL:</strong> <a href="${cred.url}" style="color: #2563eb; text-decoration: none;">${cred.url}</a></p>` : ''}
                            ${cred.email ? `<p style="margin: 0 0 4px 0; font-size: 13px; color: #374151;"><strong>Email/User:</strong> ${cred.email}</p>` : ''}
                            ${cred.password ? `<p style="margin: 0; font-size: 13px; color: #374151;"><strong>Password:</strong> ${cred.password}</p>` : ''}
                        </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Divider -->
                <div style="height: 1px; background-color: #e5e7eb; margin: 40px 0 32px 0;"></div>

                <!-- Signature -->
                <p style="margin: 0 0 24px 0; font-size: 15px; color: #374151; font-style: italic;">
                    Thanks & Regards
                </p>
                
                ${getEmailSignature({ teamName: "Software Team", email: "project@uxdlab.us" })}

            </td>
        </tr>
    </table>

</body>
</html>
`
}

export function getEmailSignature({
    teamName = "Software Team",
}: { teamName?: string, email?: string, phone?: string } = {}): string {
    return `
    <table role="presentation" style="border-collapse: collapse;">
        <tr>
            <td style="padding: 0;">
                <!-- UXDLab Logo with pink dot -->
                <table role="presentation" style="border-collapse: collapse; margin-bottom: 16px;">
                    <tr>
                        <td style="padding: 0; font-size: 32px; font-weight: 800; color: #111827; letter-spacing: -2px; vertical-align: bottom;">u</td>
                        <td style="padding: 0; vertical-align: bottom;">
                            <table role="presentation" style="border-collapse: collapse;">
                                <tr>
                                    <td align="center" style="padding: 0; line-height: 1;">
                                        <span style="display: inline-block; width: 8px; height: 8px; background-color: #ec4899; border-radius: 50%; font-size: 0;">&nbsp;</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 0; font-size: 32px; font-weight: 800; color: #111827; letter-spacing: -2px;">x</td>
                                </tr>
                            </table>
                        </td>
                        <td style="padding: 0; font-size: 32px; font-weight: 800; color: #111827; letter-spacing: -2px; vertical-align: bottom;">dlab</td>
                    </tr>
                </table>
                
                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #111827;">
                    ${teamName}
                </p>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                    UXDLAB Software Pvt. Ltd.
                </p>
            </td>
        </tr>
    </table>
    `
}


/**
 * Clean up email reply content by removing quoted text history
 */
export function cleanReplyContent(content: string): string {
    if (!content) return "";

    // Normalize line endings
    let text = content.replace(/\r\n/g, '\n');

    // 1. Split by common reply delimiters
    // These patterns attempt to match standard email client reply headers
    const delimiters = [
        /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s*.*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec).*wrote:/i,
        /On\s+.*wrote:/i,
        /From:\s+.*<.+@.+>/i,
        /_{10,}/, // Underscore lines
        /-{10,}/,  // Dashed lines like forwarded messages
        /^>.*$/m   // Quoted lines (greater than sign)
    ];

    let stopIndex = text.length;

    for (const regex of delimiters) {
        const match = text.match(regex);
        if (match && match.index !== undefined && match.index < stopIndex) {
            // Found a delimiter, cut everything after it
            stopIndex = match.index;
        }
    }

    // Cut the text
    text = text.substring(0, stopIndex).trim();

    // Remove any trailing neatness
    return text;
}

export function generateReplyTemplate({
    senderName,
    content,
    date,
    subject
}: {
    senderName: string
    content: string
    date: string
    subject?: string
}): string {
    const formattedContent = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => `<p style="margin: 0 0 12px 0; color: #374151; line-height: 1.6;">${line}</p>`)
        .join('')

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px;">
                <!-- Header -->
                <div style="margin-bottom: 24px;">
                    <span style="background-color: #ebf5ff; color: #1e40af; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">INCOMING REPLY</span>
                </div>

                <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase;">
                    ${date}
                </p>
                <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #111827;">
                    ${senderName}
                </h1>
                ${subject ? `<p style="margin: 0 0 24px 0; font-size: 16px; color: #6b7280;">Re: ${subject}</p>` : ''}

                <div style="height: 1px; background-color: #e5e7eb; margin: 0 0 32px 0;"></div>

                <!-- Content Box -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
                    <div style="font-size: 16px; line-height: 1.6; color: #374151;">
                        ${formattedContent}
                    </div>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
`
}
