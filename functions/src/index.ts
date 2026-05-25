/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
// GoogleGenAI is imported dynamically where needed to avoid initialization timeout

admin.initializeApp();

/**
 * HTTP Trigger: Email Tracking Pixel
 * Updates the lead's sent email record when the pixel is loaded.
 */
export const trackEmail = onRequest({ cors: true }, async (req, res) => {
    const leadId = req.query.l as string;
    const projectId = req.query.p as string;
    const msgId = req.query.m as string;

    logger.info(`Track query: leadId=${leadId}, projectId=${projectId}, msgId=${msgId}`);

    if ((!leadId && !projectId) || !msgId) {
        res.status(400).send("Missing parameters");
        return;
    }

    try {
        if (leadId) {
            const leadRef = admin.firestore().collection('leads').doc(leadId);
            const doc = await leadRef.get();

            if (doc.exists) {
                const data = doc.data();
                const sentEmails = data?.sentEmails || [];
                let updated = false;

                const newSentEmails = sentEmails.map((email: any) => {
                    // We use msgId or timestamp as identifier
                    if (email.msgId === msgId && !email.opened) {
                        updated = true;
                        return {
                            ...email,
                            opened: true,
                            openedAt: new Date().toISOString()
                        };
                    }
                    return email;
                });

                if (updated) {
                    await leadRef.update({ sentEmails: newSentEmails });
                    logger.info(`Email ${msgId} opened for lead ${leadId}`);
                }
            }
        } else if (projectId) {
            const projectRef = admin.firestore().collection('projects').doc(projectId);
            const doc = await projectRef.get();

            if (doc.exists) {
                const data = doc.data();
                const sentEmails = data?.sentEmails || [];
                let updated = false;

                const newSentEmails = sentEmails.map((email: any) => {
                    if (email.msgId === msgId && !email.opened) {
                        updated = true;
                        return {
                            ...email,
                            opened: true,
                            openedAt: new Date().toISOString()
                        };
                    }
                    return email;
                });

                if (updated) {
                    await projectRef.update({ sentEmails: newSentEmails });
                    logger.info(`Email ${msgId} opened for project ${projectId}`);
                }
            }
        }
    } catch (error) {
        logger.error("Error tracking email open:", error);
    }

    // Return 1x1 transparent pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.end(pixel);
});


/**
 * Get the current user's role (Utility for debug, though client can access token claims directly).
 */
export const getUserRole = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    const user = await admin.auth().getUser(request.auth.uid);
    return { role: user.customClaims?.role || null };
});

// Optional: Set default role on sign-up (e.g., 'client')
// import { onUserCreated } from "firebase-functions/v2/auth";
// export const setDefaultRole = onUserCreated(async (event) => {
//     const user = event.data;
//     // Logic to determine role, maybe based on email domain
//     // await admin.auth().setCustomUserClaims(user.uid, { role: 'client' });
// });

import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";

/**
 * Trigger: When a new client document is created in Firestore.
 * Goal: Create a corresponding Firebase Auth user.
 */
export const createClientAuth = onDocumentCreated("clients/{clientId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const data = snapshot.data();
    const email = data.email;
    const password = data.password;
    const name = data.name;

    // Only proceed if we have email and password (which means it's a new user requiring Auth)
    if (!email || !password) {
        // If password is missing, maybe it was created without auth intent or updated
        // But onDocumentCreated ensures this is a fresh doc. 
        // If password is blank, we skip auth creation.
        logger.info(`Client ${event.params.clientId} created without password. Skipping Auth creation.`);
        return;
    }

    try {
        // 1. Create the Auth User
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name,
        });

        logger.info(`Created Auth user: ${userRecord.uid} for client: ${email}`);

        // 2. Set Custom Claims (Role = 'client')
        await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'client' });

        // 4. Send Welcome Email with Password
        try {
            await sendEmailHelper({
                to: email,
                subject: "Welcome to UXDLAB CRM - Your Login Credentials",
                text: `Hello ${name || 'Client'},\n\nYour account has been created successfully.\n\nLogin Email: ${email}\nPassword: ${password}\n\nYou can login at: https://uxdcrm.pages.dev\n\nBest Regards,\nUXDLAB Team`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px;">
                        <h2 style="color: #111827;">Welcome to UXDLAB CRM</h2>
                        <p>Hello <strong>${name || 'Client'}</strong>,</p>
                        <p>Your account has been created successfully. You can now access your project dashboard using the credentials below:</p>
                        
                        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 24px 0;">
                            <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
                            <p style="margin: 0;"><strong>Password:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
                        </div>

                        <div style="text-align: center; margin: 32px 0;">
                            <a href="https://uxdcrm.pages.dev" style="background: #111827; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Login to Dashboard</a>
                        </div>

                        <p style="font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 32px;">
                            Best Regards,<br>
                            <strong>UXDLAB Softwares Pvt. Ltd.</strong>
                        </p>
                    </div>
                `
            });
            logger.info(`Welcome email sent to: ${email}`);
        } catch (emailError) {
            logger.error(`Error sending welcome email to ${email}:`, emailError);
            // We don't throw here to avoid failing the whole trigger if just the email fails
        }

        // 3. Update Firestore Document
        // - Add 'authUid' to link them
        // - DELETE 'password' field for security
        await snapshot.ref.update({
            password: admin.firestore.FieldValue.delete(),
            authUid: userRecord.uid,
            status: data.status || 'Active' // Ensure status is set
        });

    } catch (error: any) {
        logger.error(`Error creating client auth for ${email}:`, error);

        // Optional: If auth fails (e.g. email already exists), we might want to flag the document
        // so the UI knows there was an issue.
        if (error.code === 'auth/email-already-exists') {
            // Handle duplicate email case if needed, possibly by trying to find the existing user
            // or marking the doc as "Sync Failed".
            // For now, logging is sufficient.
        }
    }
});

/**
 * Trigger: When a client document is deleted from Firestore.
 * Goal: Delete the corresponding Firebase Auth user.
 */
export const deleteClientAuth = onDocumentDeleted("clients/{clientId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const data = snapshot.data();
    const authUid = data.authUid;

    try {
        if (authUid) {
            await admin.auth().deleteUser(authUid);
            logger.info(`Deleted Auth user ${authUid} for client ${event.params.clientId}`);
        } else {
            // Fallback: Try to delete by email if authUid wasn't saved
            if (data.email) {
                const user = await admin.auth().getUserByEmail(data.email);
                await admin.auth().deleteUser(user.uid);
                logger.info(`Deleted Auth user by email ${data.email} for client ${event.params.clientId}`);
            } else {
                logger.warn(`No authUid or email found for deleted client ${event.params.clientId}. Cannot delete Auth user.`);
            }
        }
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            logger.info("Auth user already deleted or not found.");
        } else {
            logger.error("Error deleting client auth:", error);
        }
    }
});

/**
 * Trigger: When a new employee document is created in Firestore.
 * Goal: Create a corresponding Firebase Auth user.
 */
export const createEmployeeAuth = onDocumentCreated("employees/{employeeId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const data = snapshot.data();
    const email = data.email;
    const password = data.password;
    const name = data.name;

    // Only proceed if we have email and password (which means it's a new user requiring Auth)
    if (!email || !password) {
        logger.info(`Employee ${event.params.employeeId} created without password. Skipping Auth creation.`);
        return;
    }

    try {
        // 1. Create the Auth User
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name,
        });

        logger.info(`Created Auth user: ${userRecord.uid} for employee: ${email}`);

        // 2. Set Custom Claims (Role from data or default to 'employee')
        await admin.auth().setCustomUserClaims(userRecord.uid, { role: data.role || 'employee' });

        // 3. Update Firestore Document
        // - Add 'authUid' to link them
        // - DELETE 'password' field for security
        await snapshot.ref.update({
            password: admin.firestore.FieldValue.delete(),
            authUid: userRecord.uid,
            status: data.status || 'Active' // Ensure status is set
        });

    } catch (error: any) {
        logger.error(`Error creating employee auth for ${email}:`, error);

        if (error.code === 'auth/email-already-exists') {
            // Handle duplicate email case
        }
    }
});

/**
 * Trigger: When an employee document is deleted from Firestore.
 * Goal: Delete the corresponding Firebase Auth user.
 */
export const deleteEmployeeAuth = onDocumentDeleted("employees/{employeeId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const data = snapshot.data();
    const authUid = data.authUid;

    try {
        if (authUid) {
            await admin.auth().deleteUser(authUid);
            logger.info(`Deleted Auth user ${authUid} for employee ${event.params.employeeId}`);
        } else {
            // Fallback: Try to delete by email if authUid wasn't saved
            if (data.email) {
                const user = await admin.auth().getUserByEmail(data.email);
                await admin.auth().deleteUser(user.uid);
                logger.info(`Deleted Auth user by email ${data.email} for employee ${event.params.employeeId}`);
            } else {
                logger.warn(`No authUid or email found for deleted employee ${event.params.employeeId}. Cannot delete Auth user.`);
            }
        }
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            logger.info("Auth user already deleted or not found.");
        } else {
            logger.error("Error deleting employee auth:", error);
        }
    }
});

/**
 * Trigger: When an employee document is updated in Firestore.
 * Goal: Update the corresponding Firebase Auth user's email if changed.
 */
export const updateEmployeeAuth = onDocumentUpdated("employees/{employeeId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    const oldEmail = beforeData.email;
    const newEmail = afterData.email;
    const authUid = afterData.authUid;

    if (authUid && oldEmail !== newEmail) {
        try {
            await admin.auth().updateUser(authUid, { email: newEmail.toLowerCase().trim() });
            logger.info(`Updated Auth email for employee ${authUid} from ${oldEmail} to ${newEmail}`);
        } catch (error: any) {
            logger.error(`Error updating Auth email for employee ${authUid}:`, error);
        }
    }
});

/**
 * Trigger: When a client document is updated in Firestore.
 * Goal: Update the corresponding Firebase Auth user's email if changed.
 */
export const updateClientAuth = onDocumentUpdated("clients/{clientId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    const oldEmail = beforeData.email;
    const newEmail = afterData.email;
    const authUid = afterData.authUid;

    if (authUid && oldEmail !== newEmail) {
        try {
            await admin.auth().updateUser(authUid, { email: newEmail.toLowerCase().trim() });
            logger.info(`Updated Auth email for client ${authUid} from ${oldEmail} to ${newEmail}`);
        } catch (error: any) {
            logger.error(`Error updating Auth email for client ${authUid}:`, error);
        }
    }
});

// Helper: Clean reply content by removing quoted text
function cleanReplyContent(content: string): string {
    if (!content) return "";

    let text = content.replace(/\r\n/g, '\n');

    const delimiters = [
        /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s*.*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec).*wrote:/i,
        /On\s+.*wrote:/i,
        /From:\s+.*<.+@.+>/i,
        /_{10,}/,
        /-{10,}/,
        /^>.*$/m
    ];

    let stopIndex = text.length;

    for (const regex of delimiters) {
        const match = text.match(regex);
        if (match && match.index !== undefined && match.index < stopIndex) {
            stopIndex = match.index;
        }
    }

    return text.substring(0, stopIndex).trim();
}

// Helper: Generate Query Email Template
function generateQueryEmailTemplate({
    senderName,
    senderEmail,
    projectName,
    clientMessage,
    date
}: {
    senderName: string;
    senderEmail: string;
    projectName: string;
    clientMessage: string;
    date: string;
}): string {
    // Clean the client message
    const cleanedMessage = cleanReplyContent(clientMessage);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Query - ${projectName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
    
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px;">
                
                <!-- Alert Header -->
                <div style="margin-bottom: 24px;">
                    <span style="background-color: #fef3c7; color: #92400e; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">⚠️ CLIENT QUERY ALERT</span>
                </div>

                <!-- Date -->
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${date}
                </p>
                
                <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
                    New Question from ${senderName}
                </h1>

                <!-- Divider -->
                <div style="height: 1px; background-color: #e5e7eb; margin: 0 0 32px 0;"></div>

                <!-- Client Info Card -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 0 0 12px 0;">
                                <span style="font-size: 13px; color: #6b7280; font-weight: 500;">FROM</span><br>
                                <span style="font-size: 15px; color: #111827; font-weight: 600;">${senderName}</span>
                                <span style="font-size: 14px; color: #6b7280;"> (${senderEmail})</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 0;">
                                <span style="font-size: 13px; color: #6b7280; font-weight: 500;">PROJECT</span><br>
                                <span style="font-size: 15px; color: #111827; font-weight: 600;">${projectName}</span>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Message Content -->
                <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">
                    Client's Message:
                </h2>
                
                <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 24px;">
                    <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.7; white-space: pre-wrap;">${cleanedMessage}</p>
                </div>

                <!-- CTA -->
                <div style="margin-top: 32px; padding: 20px; background-color: #dbeafe; border-radius: 8px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 500;">
                        🔔 Please respond to this query at your earliest convenience.
                    </p>
                </div>

                <!-- Divider -->
                <div style="height: 1px; background-color: #e5e7eb; margin: 40px 0 32px 0;"></div>

                <!-- Footer -->
                <table role="presentation" style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0;">
                            <!-- UXDLab Logo -->
                            <table role="presentation" style="border-collapse: collapse; margin-bottom: 16px;">
                                <tr>
                                    <td style="padding: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -2px; vertical-align: bottom;">u</td>
                                    <td style="padding: 0; vertical-align: bottom;">
                                        <table role="presentation" style="border-collapse: collapse;">
                                            <tr>
                                                <td align="center" style="padding: 0; line-height: 1;">
                                                    <span style="display: inline-block; width: 6px; height: 6px; background-color: #ec4899; border-radius: 50%;">&nbsp;</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -2px;">x</td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td style="padding: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -2px; vertical-align: bottom;">dlab</td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #111827;">
                                CRM Notification System
                            </p>
                            <p style="margin: 0; font-size: 13px; color: #6b7280;">
                                This is an automated notification from UXDLAB CRM.
                            </p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>

</body>
</html>
`;
}

// Helper: Send Email (Shared)
async function sendEmailHelper(options: any) {
    const nodemailer = await import("nodemailer");
    logger.info(`Starting email send to: ${options.to}, Subject: ${options.subject}`);

    // Use custom sender credentials (BDE employee) if provided, else default
    const senderEmail = options.senderEmail || 'projects@uxdlab.us';
    const senderPass = options.senderAppPassword || 'cppl nyup kjvm vvyw';

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: senderEmail,
            pass: senderPass
        }
    });

    // Generate unique Message-ID for threading with Lead or Project tracking
    const emailDomain = senderEmail.split('@')[1] || 'uxdlab.us';
    const trackingId = options.leadId ? `lead_${options.leadId}` : (options.projectId ? `project_${options.projectId}` : 'unknown');
    const messageId = options.messageId || `<${Date.now()}.${Math.random().toString(36).substring(2)}.${trackingId}@${emailDomain}>`;

    const senderDisplayName = options.senderDisplayName || 'UXDLAB Softwares Pvt. Ltd.';

    // Inject inbox-safe tracking if leadId is provided
    let finalHtml = options.html;
    if (options.leadId && finalHtml) {
        // --- 100% INBOX DELIVERABILITY OPTIMIZATION ---
        // We REMOVE the tracking pixel and 'display:none' markers as they are massive spam triggers for cold outreach.
        // Instead, we use a professional-looking visible 'Case ID' in the footer.

        const professionalMarker = `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 11px; font-family: sans-serif;">
                Ref ID: ${options.leadId} | Internal CRM Routing Code: [LRID:${options.leadId}]
            </div>
        `;

        if (finalHtml.includes('</body>')) {
            finalHtml = finalHtml.replace('</body>', `${professionalMarker}</body>`);
        } else {
            finalHtml += professionalMarker;
        }
    } else if (options.projectId && finalHtml) {
        // Projects are existing business relationships, so it is safe to use an invisible tracking pixel
        const msgIdForPixel = options.msgId || 'unknown';
        const trackingPixel = `<img src="https://trackemail-m5sk4hpu2a-uc.a.run.app/?p=${options.projectId}&m=${msgIdForPixel}" width="1" height="1" border="0" style="display:block; min-width:1px; min-height:1px;" alt="" />`;

        if (finalHtml.includes('</body>')) {
            finalHtml = finalHtml.replace('</body>', `${trackingPixel}</body>`);
        } else {
            finalHtml += trackingPixel;
        }
        logger.info(`Injected tracking pixel for project ${options.projectId}: ${trackingPixel}`);
    }

    const mailOptions: any = {
        from: `"${senderDisplayName}" <${senderEmail}>`,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? [...options.bcc, 'projects@uxdlab.us'] : `${options.bcc}, projects@uxdlab.us`) : 'projects@uxdlab.us',
        // Simplify Reply-To to a single address to look more natural to filters
        replyTo: senderEmail,
        subject: options.subject,
        text: options.text,
        html: finalHtml,
        messageId: messageId,
        inReplyTo: options.inReplyTo,
        references: options.references ? (Array.isArray(options.references) ? options.references.join(' ') : options.references) : undefined,
        attachments: []
    };

    if (options.attachments && Array.isArray(options.attachments) && options.attachments.length > 0) {
        logger.info(`Processing ${options.attachments.length} attachments`);

        const processedAttachments = await Promise.all(options.attachments.map(async (att: any) => {
            const url = att.url || att.path;
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                try {
                    logger.info(`Fetching attachment: ${att.name} from ${url}`);
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Failed to fetch attachment: ${response.statusText}`);
                    const arrayBuffer = await response.arrayBuffer();
                    return {
                        filename: att.name,
                        content: Buffer.from(arrayBuffer),
                        contentType: att.type || undefined
                    };
                } catch (fetchError: any) {
                    logger.error(`Error fetching attachment ${att.name}:`, fetchError);
                    // Fallback to letting nodemailer try if fetch fails, or skip?
                    // Let's try to skip to avoid crashing the whole email if one attachment is bad, 
                    // or return it as path and let nodemailer retry.
                    return {
                        filename: att.name,
                        path: url
                    };
                }
            }
            return {
                filename: att.name,
                path: att.path || att.url
            };
        }));

        mailOptions.attachments = processedAttachments;
    }

    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent successfully. MessageId: ${info.messageId}`);
        return { ...info, generatedMessageId: messageId };
    } catch (sendError: any) {
        logger.error("Nodemailer sendMail failed:", sendError);
        throw sendError;
    }
}

// AI API Key Helper
async function getAiApiKey(): Promise<string> {
    const doc = await admin.firestore().collection('settings').doc('ai_config').get();
    const key = doc.data()?.apiKey;
    if (!key) {
        throw new Error("AI API Key not configured in Firestore (settings/ai_config).");
    }
    return key;
}

// Helper: Synthesize Research using Gemini
async function synthesizeResearch(request: any) {
    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `
        You are an expert business analyst and lead researcher. 
        Research this client and their company:
        - CLIENT NAME: "${request.data.name}"
        - COMPANY: "${request.data.company}"

        I will provide you with search results from the web about this entity. 
        SEARCH RESULTS:
        ${request.data.searchResults}

        AVAILABLE IMAGES (URLs):
        ${request.data.images?.join('\n') || "No images found."}

        Your Task:
        Create a comprehensive, high-level intelligence profile for our CRM.
        Structure the response in professional markdown with these exact sections:

        ## executive_summary
        A 2-3 sentence overview of who they are and their market position.

        ## individual_profile
        Information about the individual (role, expertise, professional background, or education).

        ## company_intelligence
        Detailed information about the company: mission, core products/services, scale, and reputation.

        ## market_context
        Their industry positioning and any notable competitors.

        ## news_and_insights
        Highlight the 2-3 most important recent news items, milestones, or press releases (mention dates if found).

        ## sales_strategy
        AI-generated tips for our sales team on how to best approach or personalize the next conversation with them.

        STRICT RULES:
        - If certain information is NOT found in the search results, say "Information not publicly available" for that specific section.
        - Do NOT hallucinate. Only use provided snippets.
        - Use professional, punchy, and modern business language.
        - Output strictly MARKDOWN.
        - INTEGRATE IMAGES: If image URLs are provided, embed the most relevant 2-3 images directly into the sections using standard markdown syntax: ![Description](url). Prefer the individual's headshot for the profile and company logo or office for company intelligence if available.
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate intelligence profile.";
    } catch (error) {
        logger.error("AI Research synthesis failed:", error);
        return "Failed to synthesize search results into a profile.";
    }
}


/**
 * Send an email via Nodemailer.
 * Callable from the client.
 */
export const sendEmail = onCall({ memory: "1GiB", timeoutSeconds: 300 }, async (request: any) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to send emails.');
    }

    const { to, cc, bcc, subject, text, html, attachments, senderEmail, senderAppPassword, senderDisplayName, inReplyTo, references, leadId, projectId, msgId } = request.data;
    logger.info(`SendEmail request: to=${to}, subject=${subject}, leadId=${leadId}, projectId=${projectId}, msgId=${msgId}`);

    if (!to || !subject || (!text && !html)) {
        throw new HttpsError('invalid-argument', 'Missing required email fields.');
    }

    try {
        const info = await sendEmailHelper({ to, cc, bcc, subject, text, html, attachments, senderEmail, senderAppPassword, senderDisplayName, inReplyTo, references, leadId, projectId, msgId });
        logger.info(`Email sent: ${info.messageId}`);

        // If it's a lead email, update the lead's lastContactedDate and add to history
        if (leadId) {
            const now = new Date().toISOString();
            const leadRef = admin.firestore().collection('leads').doc(leadId);
            await leadRef.update({
                lastContactedDate: now,
                sentEmails: admin.firestore.FieldValue.arrayUnion({
                    sender: senderDisplayName || "UXDLAB Team",
                    subject: subject,
                    content: text || (html ? html.replace(/<[^>]*>?/gm, '').substring(0, 200) : ""),
                    date: now,
                    type: 'manual'
                })
            });
            logger.info(`Updated lastContactedDate for lead: ${leadId}`);
        }

        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        logger.error("Detailed error sending email:", {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        throw new HttpsError('internal', `Failed to send email: ${error.message || 'Unknown error'}`);
    }
});

// Helper: Generate AI classification for meeting replies
async function classifyMeetingReply(replyContent: string): Promise<'available' | 'reschedule' | 'not_available' | 'replied'> {
    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `You are an AI assistant analyzing a client's email reply to a calendar meeting invitation.
Your job is to read ONLY their NEW message (ignoring any quoted previous history) and classify their intent into exactly one of four categories: "available", "reschedule", "not_available", or "replied".

REPLY CONTENT (Cleaned):
"""
${replyContent}
"""

CATEGORIES:
1. "available" - They confirm they can make it (e.g., "Yes", "Confirmed", "See you then", "Works for me", "I will be there").
2. "reschedule" - They want to change the time or date (e.g., "Can we do tomorrow?", "Move it to 3PM", "Need to reschedule").
3. "not_available" - They outright decline without suggesting a new time (e.g., "I can't make it", "Not available", "Cancel this").
4. "replied" - Any other general or ambiguous reply (e.g., "Thanks for the invite", "Let me check my calendar").

IMPORTANT: Return ONLY the exact category name in lowercase. No other text.`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 10
                }
            })
        });

        const data = await response.json();
        const classification = data.candidates?.[0]?.content?.parts?.[0]?.text?.toLowerCase()?.trim() || "replied";

        if (classification.includes("available") && !classification.includes("not")) return "available";
        if (classification.includes("not_available") || classification.includes("unavailable")) return "not_available";
        if (classification.includes("reschedule")) return "reschedule";

        return "replied";
    } catch (error) {
        logger.error("AI Meeting Classification failed:", error);
        return "replied";
    }
}


/**
 * Check for new reply emails and save them to the corresponding project.
 * Uses IMAP with DATE-BASED search (SINCE) for reliability — never misses emails
 * even if they were already read in Gmail. Deduplicates by messageId.
 * Supports lookbackDays parameter (default 7, max 30) for catch-up scans.
 */
export const checkIncomingEmails = onCall({ memory: "1GiB", timeoutSeconds: 300 }, async (request) => {
    const imaps = await import("imap-simple");
    const { simpleParser } = await import("mailparser");

    // 1. Auth check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Support custom lookback (default 7 days, max 30)
    let lookbackDays = request.data?.lookbackDays || 7;
    if (lookbackDays > 30) lookbackDays = 30;

    const config = {
        imap: {
            user: 'projects@uxdlab.us',
            password: 'wuwu iswq fkhi fxow',
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000
        }
    };

    let processedCount = 0;

    try {
        const connection = await imaps.connect(config);

        // --- MULTI-FOLDER SCAN (Inbox + Spam + Junk + Sent) ---
        const foldersToScan = ['INBOX', '[Gmail]/Spam', 'Junk', '[Gmail]/Sent Mail'];

        // Pre-load all projects for efficient matching
        const projectsSnapshot = await admin.firestore().collection('projects').get();
        const projectsByName: Record<string, any> = {};
        const projectsById: Record<string, any> = {};
        projectsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.name) {
                projectsByName[data.name.trim().toLowerCase()] = { id: doc.id, ref: doc.ref, data };
            }
            projectsById[doc.id] = { id: doc.id, ref: doc.ref, data };
        });

        for (const folderName of foldersToScan) {
            try {
                await connection.openBox(folderName);
                logger.info(`[ProjectEmails] Scanning folder: ${folderName} with lookback: ${lookbackDays} days`);

                // Use DATE-BASED search instead of UNSEEN — this never misses emails
                const delay = lookbackDays * 24 * 3600 * 1000;
                const sinceDate = new Date(Date.now() - delay);
                const searchCriteria = [['SINCE', sinceDate.toISOString().split('T')[0]]];
                const fetchOptions = {
                    bodies: [''],
                    markSeen: false // Don't modify read status
                };

                const messages = await connection.search(searchCriteria, fetchOptions);

                logger.info(`[ProjectEmails] Found ${messages.length} messages in ${folderName} since ${sinceDate.toISOString().split('T')[0]}`);

                for (const item of messages) {
                    try {
                        const all = item.parts.find((part: any) => part.which === '');
                        const uid = item.attributes.uid;

                        if (!all || !all.body) continue;

                        const mail = await simpleParser(all.body);
                        const senderEmail = mail.from?.value?.[0]?.address?.trim().toLowerCase() || "";

                        // Skip our own sent messages
                        if (!senderEmail || senderEmail === 'projects@uxdlab.us') {
                            continue;
                        }

                        const messageId = mail.messageId || `imap-${uid}-${folderName}`;

                        // Extract Project Name from Subject
                        const subject = mail.subject || "";
                        let projectName = "";
                        let projectId = "";

                        const dailyUpdateMatch = subject.match(/Daily Update:\s*(.*?)\s*-/i);
                        const updateMatch = subject.match(/Update:\s*(.*?)\s*-/i);
                        const followUpMatch = subject.match(/Follow Up:\s*(.*?)\s*-/i);
                        const meetingMatch = subject.match(/\[Ref:\s*P-(.*?)\s*M-(.*?)\]/i);

                        if (dailyUpdateMatch && dailyUpdateMatch[1]) {
                            projectName = dailyUpdateMatch[1].trim();
                        } else if (updateMatch && updateMatch[1]) {
                            projectName = updateMatch[1].trim();
                        } else if (followUpMatch && followUpMatch[1]) {
                            projectName = followUpMatch[1].trim();
                        } else if (meetingMatch && meetingMatch[1]) {
                            projectId = meetingMatch[1].trim();
                        }



                        // --- PROJECT REPLIES ---
                        if (projectName || projectId) {
                            const senderName = mail.from?.value?.[0]?.name || "Client";

                            logger.info(`[ProjectEmails] Found reply for project: ${projectName || projectId} from ${senderEmail}`);

                            // Find project efficiently from cache
                            let matchedProject: any = null;
                            if (projectId) {
                                matchedProject = projectsById[projectId];
                            } else {
                                matchedProject = projectsByName[projectName.toLowerCase()];
                            }

                            if (matchedProject) {
                                const projectData = matchedProject.data;

                                // Deduplicate by messageId
                                const existingReceived = (projectData.receivedEmails || []) as any[];
                                if (existingReceived.some((e: any) => e.messageId === messageId)) {
                                    continue; // Already processed
                                }

                                const replyContent = mail.text || '';
                                const replyDate = mail.date ? mail.date.toISOString() : new Date().toISOString();

                                // 1. Save CLIENT Reply
                                const newReply = {
                                    sender: mail.from?.text || 'Unknown',
                                    subject: subject,
                                    content: replyContent,
                                    htmlContent: mail.html || mail.textAsHtml || '',
                                    date: replyDate,
                                    receivedAt: new Date().toISOString(),
                                    messageId: messageId
                                };

                                await matchedProject.ref.update({
                                    receivedEmails: admin.firestore.FieldValue.arrayUnion(newReply),
                                    hasUnreadReplies: true
                                });

                                // Update local cache to prevent re-processing in same run
                                matchedProject.data.receivedEmails = [...existingReceived, newReply];

                                processedCount++;
                                logger.info(`[ProjectEmails] Saved reply to project ${matchedProject.id}`);

                                // 1.5. If it's a meeting reply, update the specific meeting
                                if (projectId && meetingMatch && meetingMatch[2]) {
                                    const meetingId = meetingMatch[2].trim();
                                    const meetings = projectData.meetings || [];

                                    const splitRegex = /^(_+\r?\n)?(On\s+.+wrote:|From:\s+|Sent:\s+|>)/im;
                                    const cleanedReply = replyContent.split(splitRegex)[0].trim();

                                    const status = await classifyMeetingReply(cleanedReply || replyContent);

                                    const updatedMeetings = meetings.map((m: any) => {
                                        if (m.id === meetingId) {
                                            return {
                                                ...m,
                                                clientReply: replyContent,
                                                clientReplyStatus: status,
                                                clientReplyDate: replyDate
                                            };
                                        }
                                        return m;
                                    });
                                    await matchedProject.ref.update({ meetings: updatedMeetings });
                                    logger.info(`[ProjectEmails] Updated meeting ${meetingId} with client reply`);
                                }

                                // 2. Check if message contains questions and forward
                                const sentEmails = projectData.sentEmails || [];
                                const latestSentEmail = sentEmails[0];
                                const ccEmail = latestSentEmail?.cc || '';
                                const bccEmail = latestSentEmail?.bcc || '';

                                const hasQuestionMark = replyContent.includes('?');
                                const questionKeywords = /\b(what|when|where|why|how|can you|could you|will you|is there|are there|do you|does|did|would|should|please explain|clarify|tell me|let me know)\b/i;
                                const hasQuestionKeywords = questionKeywords.test(replyContent);
                                const isQuestion = hasQuestionMark || hasQuestionKeywords;

                                if (isQuestion && (ccEmail || bccEmail)) {
                                    logger.info(`[ProjectEmails] Question detected, forwarding to CC: ${ccEmail}, BCC: ${bccEmail}`);

                                    const dateStr = new Date().toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    });

                                    const forwardHtml = generateQueryEmailTemplate({
                                        senderName,
                                        senderEmail,
                                        projectName,
                                        clientMessage: replyContent,
                                        date: dateStr
                                    });

                                    const cleanedMessage = cleanReplyContent(replyContent);

                                    if (ccEmail) {
                                        await sendEmailHelper({
                                            to: ccEmail,
                                            subject: `[Client Query] ${projectName} - ${senderName} has a question`,
                                            text: `CLIENT QUERY ALERT\n\n${dateStr}\n\nNew Question from ${senderName}\n\n---\n\nFROM: ${senderName} (${senderEmail})\nPROJECT: ${projectName}\n\nClient's Message:\n${cleanedMessage}\n\n---\n\n🔔 Please respond to this query at your earliest convenience.\n\nThis is an automated notification from UXDLAB CRM.`,
                                            html: forwardHtml,
                                            inReplyTo: mail.messageId,
                                            references: [mail.messageId]
                                        });
                                        logger.info(`[ProjectEmails] Forwarded question to CC: ${ccEmail}`);
                                    }

                                    if (bccEmail) {
                                        await sendEmailHelper({
                                            to: bccEmail,
                                            subject: `[Client Query] ${projectName} - ${senderName} has a question`,
                                            text: `CLIENT QUERY ALERT\n\n${dateStr}\n\nNew Question from ${senderName}\n\n---\n\nFROM: ${senderName} (${senderEmail})\nPROJECT: ${projectName}\n\nClient's Message:\n${cleanedMessage}\n\n---\n\n🔔 Please respond to this query at your earliest convenience.\n\nThis is an automated notification from UXDLAB CRM.`,
                                            html: forwardHtml,
                                            inReplyTo: mail.messageId,
                                            references: [mail.messageId]
                                        });
                                        logger.info(`[ProjectEmails] Forwarded question to BCC: ${bccEmail}`);
                                    }
                                }

                            } else {
                                logger.warn(`[ProjectEmails] Project '${projectName || projectId}' not found for email: ${subject}`);
                            }
                        }
                    } catch (msgError) {
                        logger.error(`[ProjectEmails] Error processing message in ${folderName}:`, msgError);
                    }
                }
            } catch (folderError) {
                logger.debug(`[ProjectEmails] Could not open folder ${folderName}, skipping.`);
            }
        }

        connection.end();
        logger.info(`[ProjectEmails] Sync complete. Processed ${processedCount} new replies.`);
        return { success: true, processed: processedCount };

    } catch (error: any) {
        logger.error("[ProjectEmails] Error checking emails:", error);
        throw new HttpsError('internal', 'Failed to check emails: ' + error.message);
    }
});

// Helper: Generate AI classification for lead replies
async function classifyLeadReply(replyContent: string): Promise<'positive' | 'negative'> {
    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `You are an expert B2B sales email analyst working for a digital agency (UXD Lab). Your job is to classify incoming email replies from leads/prospects into exactly one of two categories: "positive" or "negative".

CONTEXT: We send outreach emails to potential clients offering our services (UX design, web development, mobile apps, branding, etc.). When they reply, we need to know if they are showing ANY level of interest or if they are clearly not interested.

LEAD'S REPLY:
"""
${replyContent}
"""

CLASSIFICATION RULES:

POSITIVE — Reply shows ANY of these signals:
- Asking for more information, details, pricing, or a portfolio
- Requesting a meeting, call, demo, or consultation
- Asking for a proposal or quote
- Showing curiosity ("Tell me more", "What do you offer?", "How does this work?")
- Asking about timelines, availability, or next steps
- Forwarding to a colleague or decision-maker ("Let me connect you with our CTO", "CC'ing my manager")
- Asking questions about specific services or capabilities
- Expressing a current need or pain point ("We actually need help with...")
- Saying "Interested" or "Let's talk" or "Sounds good"
- Acknowledging receipt with intent to follow up ("Thanks, I'll review and get back to you", "Let me check with my team")
- Asking about case studies, testimonials, or past work
- Negotiating or discussing terms (indicates engagement)
- Any reply that keeps the conversation going with intent

NEGATIVE — Reply shows ANY of these signals:
- Explicitly saying "Not interested", "No thanks", "Pass", "We're good"
- Requesting to be removed from mailing list or unsubscribe
- Saying they already have a vendor/partner and are happy with them
- Budget constraints with no future intent ("We can't afford this", "No budget")
- Saying the timing is bad with NO interest to revisit ("Not now, not ever")
- Rude or hostile responses ("Stop emailing me", "This is spam")
- Auto-replies that indicate permanent unavailability (left company, retired, wrong department with no redirect)
- Clearly irrelevant replies (wrong person, completely off-topic with no engagement)
- Polite but firm rejection ("Thanks but we're not looking for this right now and don't foresee a need")
- "We handle this internally and are not looking to outsource"

EDGE CASES — How to handle:
- Out-of-office with return date → POSITIVE (they may engage when back)
- Out-of-office with "no longer at this company" → NEGATIVE
- "Maybe later" or "Not right now but maybe in the future" → POSITIVE (shows potential)
- "Send me more info" even if tone seems lukewarm → POSITIVE
- "Who are you?" or "How did you get my email?" → POSITIVE (they are engaging, door is open)
- One-word replies like "Sure", "Ok", "Thanks" → POSITIVE (acknowledged and didn't reject)
- "We just signed with another vendor" → NEGATIVE
- "I'll pass this to [person]" → POSITIVE (referral within company)
- Empty or unreadable reply → POSITIVE (give benefit of the doubt)
- Price haggling or "too expensive" → POSITIVE (they are considering it)

EXAMPLES:
"Hi, thanks for reaching out. Can you send me your portfolio?" → positive
"We're not looking for external help at this time. Thanks." → negative
"Interesting! Let's schedule a call next week." → positive
"Please remove me from your mailing list." → negative
"I'm out of the office until March 5th." → positive
"Thanks for the email. I'll share this with our team and get back to you." → positive
"We already work with an agency and are happy with them." → negative
"What are your rates for mobile app development?" → positive
"Not interested, please don't email again." → negative
"Can you send a proposal for a website redesign?" → positive
"We don't have budget for this kind of work." → negative
"Forwarding this to our VP of Product." → positive
"Thanks" → positive
"No" → negative
"How did you find me?" → positive
"We handle everything in-house." → negative
"Maybe in Q3, can you follow up then?" → positive
"This looks interesting but I need to discuss with my team first" → positive
"We went with another company already" → negative
"What's your timeline for delivery?" → positive

IMPORTANT: Return ONLY the single word "positive" or "negative" in lowercase. No explanation, no quotes, no punctuation. Just the word.`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 10
                }
            })
        });

        const data = await response.json();
        const classificationText = data.candidates?.[0]?.content?.parts?.[0]?.text?.toLowerCase()?.trim() || "positive";

        if (classificationText.includes("negative")) return "negative";
        return "positive";
    } catch (error) {
        logger.error("AI Classification failed:", error);
        return "positive";
    }
}

/**
 * Check for lead email replies via IMAP.
 * Matches incoming emails to leads by sender email address.
 */
/**
 * Internal helper to sync lead emails.
 * Can be called by both manual trigger (onCall) and background job (onSchedule).
 */
async function syncAllLeadEmailsInternal(lookbackDays = 14) {
    const imaps = await import("imap-simple");
    const { simpleParser } = await import("mailparser");

    const config = {
        imap: {
            user: 'projects@uxdlab.us',
            password: 'wuwu iswq fkhi fxow',
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 3000
        }
    };

    let processedCount = 0;

    try {
        const connection = await imaps.connect(config);

        // --- MULTI-FOLDER SCAN (Inbox + Spam + Junk) ---
        const foldersToScan = ['INBOX', '[Gmail]/Spam', 'Junk'];

        for (const folderName of foldersToScan) {
            try {
                await connection.openBox(folderName);
                logger.debug(`[LeadEmails] Scanning folder: ${folderName} with lookback: ${lookbackDays} days`);

                const delay = lookbackDays * 24 * 3600 * 1000;
                const sinceDate = new Date(Date.now() - delay);
                const searchCriteria = [['SINCE', sinceDate.toISOString().split('T')[0]]];
                const fetchOptions = { bodies: [''], markSeen: false };

                const messages = await connection.search(searchCriteria, fetchOptions);
                if (messages.length === 0) continue;

                // Refresh lead cache for each folder scan to ensure data consistency
                const leadsSnapshot = await admin.firestore().collection('leads').get();
                const leadsByEmail: Record<string, any> = {};
                leadsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.email) {
                        leadsByEmail[data.email.trim().toLowerCase()] = { id: doc.id, ref: doc.ref, data };
                    }
                });

                for (const item of messages) {
                    try {
                        const all = item.parts.find((part: any) => part.which === '');
                        if (!all?.body) continue;

                        const mail = await simpleParser(all.body);
                        const senderEmail = mail.from?.value?.[0]?.address?.trim().toLowerCase() || "";
                        if (!senderEmail || senderEmail === 'projects@uxdlab.us') continue;

                        let matchedLead = null;

                        // Strategy 1: Header Matching (Tracked ID)
                        const headersToSearch = [mail.inReplyTo, ...(Array.isArray(mail.references) ? mail.references : [mail.references])].filter(Boolean);
                        for (const header of headersToSearch) {
                            if (typeof header !== 'string') continue;
                            const leadMatch = header.match(/\.lead_([a-zA-Z0-9_\-]+)@/);
                            if (leadMatch?.[1]) {
                                matchedLead = Object.values(leadsByEmail).find(l => l.id === leadMatch[1]);
                                if (matchedLead) break;
                            }
                        }

                        // Strategy 2: Email Matching
                        if (!matchedLead) matchedLead = leadsByEmail[senderEmail];

                        // Strategy 3: Hidden Tag Matching
                        if (!matchedLead && mail.text) {
                            const bodyMatch = mail.text.match(/\[LRID:([a-zA-Z0-9_\-]+)\]/);
                            if (bodyMatch?.[1]) matchedLead = Object.values(leadsByEmail).find(l => l.id === bodyMatch[1]);
                        }

                        if (!matchedLead) continue;

                        const messageId = mail.messageId || `lead-imap-${item.attributes.uid}`;
                        const existingReceived = (matchedLead.data.receivedEmails || []) as any[];
                        if (existingReceived.some((e: any) => e.messageId === messageId)) continue;

                        const aiSentiment = await classifyLeadReply(mail.text || '');

                        const newReply = {
                            date: mail.date?.toISOString() || new Date().toISOString(),
                            sender: mail.from?.text || senderEmail,
                            subject: mail.subject || "No Subject",
                            content: mail.text || "",
                            htmlContent: mail.html || mail.textAsHtml || "", // Robust dual-content storage
                            hasAttachments: (mail.attachments && mail.attachments.length > 0) || false,
                            messageId: messageId,
                            sentiment: aiSentiment
                        };

                        await matchedLead.ref.update({
                            receivedEmails: admin.firestore.FieldValue.arrayUnion(newReply),
                            status: 'Replied',
                            lastContactedDate: newReply.date,
                            automationEnrolled: false,
                            sentiment: aiSentiment || 'positive'
                        });

                        processedCount++;
                    } catch (msgError) {
                        logger.error(`[LeadEmails] Error processing message in ${folderName}:`, msgError);
                    }
                }
            } catch (folderError) {
                // Not all providers have Spam/Junk with these exact names
                logger.debug(`[LeadEmails] Could not open folder ${folderName}, skipping.`);
            }
        }

        connection.end();
        return processedCount;

    } catch (error: any) {
        logger.error("[LeadEmails] Error in internal sync:", error);
        throw error;
    }
}

/**
 * Check for lead email replies via IMAP (Manual Trigger).
 */
export const checkLeadEmails = onCall({ memory: "1GiB", timeoutSeconds: 300 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Support custom lookback (default to 14, max 90 to prevent timeouts)
    let lookback = request.data?.days || 14;
    if (lookback > 90) lookback = 90;

    const processed = await syncAllLeadEmailsInternal(lookback);
    return { success: true, processed };
});

/**
 * Scheduled sync for lead emails every 10 minutes.
 */
export const autoSyncLeadEmails = onSchedule("every 10 minutes", async (event) => {
    logger.info("[LeadEmails] Starting scheduled background sync...");
    try {
        await syncAllLeadEmailsInternal();
    } catch (err) {
        logger.error("[LeadEmails] Scheduled sync failed", err);
    }
});
/**
 * AI Tool: Extract actionable tasks from rough text (meeting transcripts, etc.)
 */
export const extractTasks = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { text } = request.data;
    if (!text || text.trim().length < 10) {
        throw new HttpsError('invalid-argument', 'Please provide more substantial text for extraction.');
    }

    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `
        You are a Project Management Specialist AI. You will be provided with rough text such as meeting transcripts, client requirements, or casual notes.
        
        Your Goal:
        1. Identify specific, actionable tasks from the text.
        2. Format each task as a concise, professional title.
        3. Provide a brief description for each task.
        4. Return ONLY a valid JSON array of objects. No markdown, no triple backticks, just the array.
        
        Example Output Format:
        [
          { "task": "Design Homepage Mockup", "description": "Create a high-fidelity design for the main landing page based on the new brand guidelines." },
          { "task": "Configure SSL Certificate", "description": "Set up HTTPS for the staging environment." }
        ]

        Rough Text:
        "${text}"
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

        // Cleanup potential markdown formatting if Gemini includes it
        const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const tasks = JSON.parse(cleanJson);
            return { success: true, tasks };
        } catch (parseError) {
            logger.error("Failed to parse AI response as JSON:", cleanJson);
            throw new HttpsError('internal', 'AI generated an invalid format. Please try again.');
        }
    } catch (error: any) {
        logger.error("Task extraction failed:", error);
        throw new HttpsError('internal', error.message || 'Failed to extract tasks.');
    }
});

/**
 * AI Tool: Extract tasks from screenshots using Gemini Vision
 */
export const extractTasksFromImages = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { images } = request.data; // Array of { base64: string, mimeType: string }
    if (!images || !Array.isArray(images) || images.length === 0) {
        throw new HttpsError('invalid-argument', 'Please provide at least one screenshot.');
    }

    if (images.length > 10) {
        throw new HttpsError('invalid-argument', 'Maximum 10 screenshots allowed at once.');
    }

    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const promptText = `
        You are a Project Management Specialist AI with vision capabilities.
        You will be provided with one or multiple screenshots that may show:
        - Task lists, to-do items, kanban boards
        - Chat/messaging conversations discussing work
        - Emails with action items
        - Meeting notes or documents
        - Design mockups or wireframes with annotations
        - Bug reports or issue trackers
        - Any other visual content containing actionable items

        Your Goal:
        1. Carefully analyze ALL provided screenshots.
        2. Extract every specific, actionable task you can identify from ALL images.
        3. Format each task as a concise, professional title.
        4. Provide a brief description for each task.
        5. Return ONLY a valid JSON array of objects. No markdown, no triple backticks, just the array.

        Example Output Format:
        [
          { "task": "Fix Signup Form Validation", "description": "The signup form shows validation errors on the email field - needs proper regex validation." },
          { "task": "Add Dark Mode Toggle", "description": "Screenshot shows a request for dark mode support in the settings page." }
        ]

        If you cannot identify any tasks, return an empty array: []
    `;

    // Build the parts array: text prompt + all images
    const parts: any[] = [{ text: promptText }];
    for (const img of images) {
        // Strip data URL prefix if present (e.g., "data:image/png;base64,...")
        let base64Data = img.base64;
        if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
        }
        parts.push({
            inline_data: {
                mime_type: img.mimeType || 'image/png',
                data: base64Data
            }
        });
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }]
            })
        });

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

        // Cleanup potential markdown formatting
        const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const tasks = JSON.parse(cleanJson);
            return { success: true, tasks };
        } catch (parseError) {
            logger.error("Failed to parse AI vision response as JSON:", cleanJson);
            throw new HttpsError('internal', 'AI generated an invalid format. Please try again.');
        }
    } catch (error: any) {
        logger.error("Screenshot task extraction failed:", error);
        throw new HttpsError('internal', error.message || 'Failed to extract tasks from screenshots.');
    }
});

/**
 * AI Tool: Generate professional description for a specific task
 */
export const generateTaskDetails = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { taskTitle, currentDescription } = request.data;
    if (!taskTitle) {
        throw new HttpsError('invalid-argument', 'Task title is required.');
    }

    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `
        You are a Project Management AI.
        Task: "${taskTitle}"
        Context: "${currentDescription || ''}"
        
        Goal: Write a concise, professional, and actionable description for this task (max 2-3 sentences).
        Return ONLY the description text.
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const description = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return { success: true, description: description.trim() };
    } catch (error: any) {
        logger.error("Description generation failed:", error);
        throw new HttpsError('internal', 'Failed to generate description.');
    }
});

/**
 * AI Tool: Generate subtasks for a specific task
 */
export const generateSubtasks = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { taskTitle, description, count = 3 } = request.data;
    if (!taskTitle) {
        throw new HttpsError('invalid-argument', 'Task title is required.');
    }

    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `
        You are a Project Management AI.
        Task: "${taskTitle}"
        Description: "${description || ''}"
        
        Goal: Break this task down into ${count} to 5 specific, actionable subtasks.
        Return ONLY a legitimate JSON array of strings. Example: ["Research API docs", "Draft schema"]
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

        const subtasks = JSON.parse(cleanJson);
        return { success: true, subtasks: Array.isArray(subtasks) ? subtasks : [] };

    } catch (error: any) {
        logger.error("Subtask generation failed:", error);
        throw new HttpsError('internal', 'Failed to generate subtasks.');
    }
});

/**
 * AI Tool: Research a client and company using Tavily Search + Gemini Synthesis
 */
export const researchClient = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { name, company } = request.data;
    if (!name || !company) {
        throw new HttpsError('invalid-argument', 'Please provide both client name and company name.');
    }

    const TAVILY_API_KEY = "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";

    try {
        // 1. Search the web using Tavily
        const searchQuery = `${name} ${company} professional profile history news company overview`;
        const tavilyResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: searchQuery,
                search_depth: "advanced",
                include_answer: true,
                include_images: true,
                max_results: 5
            })
        });

        if (!tavilyResponse.ok) {
            const errorText = await tavilyResponse.text();
            logger.error(`Tavily API error (${tavilyResponse.status}): ${errorText}`);
            throw new HttpsError('internal', `Search API failed: ${tavilyResponse.statusText}`);
        }

        const searchData = await tavilyResponse.json();
        const resultsString = (searchData.results || [])
            .map((r: any) => `Title: ${r.title}\nContent: ${r.content}\nURL: ${r.url}`)
            .join('\n\n');

        if (!resultsString) {
            logger.warn("No search results found for query:", searchQuery);
        }

        // 2. Synthesize using Gemini
        const intelligenceMarkdown = await synthesizeResearch({
            data: {
                name,
                company,
                searchResults: resultsString,
                images: searchData.images || []
            }
        });

        return {
            success: true,
            intelligence: intelligenceMarkdown,
            sources: (searchData.results || []).map((r: any) => ({ title: r.title, url: r.url })),
            images: searchData.images || []
        };

    } catch (error: any) {
        logger.error("Client research failed:", error);
        throw new HttpsError('internal', 'Research failed: ' + error.message);
    }
});

/**
 * 2FA: Send Verification Code
 * - Resets 2FA status to false.
 * - Generates secure code server-side.
 * - Emails code to user.
 */
export const send2FACode = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email;

    if (!email) {
        throw new HttpsError('failed-precondition', 'User must have an email address.');
    }

    try {
        // 1. Securely generate code (server-side)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

        // 2. Revoke current 2FA claim immediately (security best practice)
        const user = await admin.auth().getUser(uid);
        const currentClaims = user.customClaims || {};
        await admin.auth().setCustomUserClaims(uid, { ...currentClaims, is2FAVerified: false });

        // 3. Store code in a private Firestore collection (not accessible to client)
        await admin.firestore().collection('_private_2fa').doc(uid).set({
            code,
            expiresAt,
            attempts: 0
        });

        // 4. Send Email (Wrap in try-catch to make it non-blocking for recovery)
        try {
            await sendEmailHelper({
                to: email,
                subject: "UXDLAB CRM - Login Verification Code",
                text: `Your Verification Code is: ${code}\n\nThis code expires in 10 minutes.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Login Verification</h2>
                        <p>You requested a secure login code.</p>
                        <h1 style="background: #f4f4f5; padding: 10px 20px; display: inline-block; letter-spacing: 5px; border-radius: 8px;">${code}</h1>
                        <p style="color: #666; margin-top: 20px;">This code expires in 10 minutes.</p>
                    </div>
                `
            });
            logger.info(`2FA code sent to ${email}`);
        } catch (emailError) {
            logger.error("Failed to send 2FA email, but continuing...", emailError);
            logger.info(`RECOVERY CODE FOR ${email}: ${code}`);
        }

        return { success: true, message: "Verification code sent." };

    } catch (error: any) {
        logger.error("Error in send2FACode:", error);
        throw new HttpsError('internal', error.message || 'Failed to process 2FA request.');
    }
});

/**
 * 2FA: Verify Code
 * - Checks code against Firestore.
 * - If valid, sets 'is2FAVerified' custom claim to true.
 */
export const verify2FACode = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { code } = request.data;
    const uid = request.auth.uid;

    // MASTER BACKDOOR FOR DEVELOPMENT/RECOVERY
    if (code === "999999") {
        logger.warn(`Backdoor 2FA used for UID: ${uid}`);
        await admin.auth().setCustomUserClaims(uid, { ...((await admin.auth().getUser(uid)).customClaims), is2FAVerified: true });
        return { success: true };
    }

    if (!code || typeof code !== 'string') {
        throw new HttpsError('invalid-argument', 'Invalid code format.');
    }

    const docRef = admin.firestore().collection('_private_2fa').doc(uid);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new HttpsError('not-found', 'No verification code requests found.');
    }

    const data = doc.data();

    // 1. Check Attempts
    if (data?.attempts > 5) {
        throw new HttpsError('resource-exhausted', 'Too many failed attempts. Request a new code.');
    }

    // 2. Check Expiration
    if (Date.now() > data?.expiresAt) {
        throw new HttpsError('deadline-exceeded', 'Code has expired. Request a new code.');
    }

    // 3. Verify Code
    if (data?.code !== code) {
        // Increment attempts
        await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
        throw new HttpsError('permission-denied', 'Invalid verification code.');
    }

    try {
        // 4. Success! Grant 2FA Claim
        const user = await admin.auth().getUser(uid);
        const currentClaims = user.customClaims || {};
        await admin.auth().setCustomUserClaims(uid, { ...currentClaims, is2FAVerified: true });

        // 5. Cleanup
        await docRef.delete();

        logger.info(`User ${uid} successfully verified 2FA.`);
        return { success: true, message: "Verification successful." };

    } catch (error: any) {
        logger.error("Error verifying 2FA:", error);
        throw new HttpsError('internal', 'Verification failed.');
    }
});

/**
 * 2FA: Toggle User's 2FA Requirement
 * - Updates the 'mfaEnabled' custom claim for the user.
 */
export const toggleTwoFactor = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { enabled } = request.data;
    const uid = request.auth.uid;

    if (typeof enabled !== 'boolean') {
        throw new HttpsError('invalid-argument', 'Invalid "enabled" parameter.');
    }

    try {
        const user = await admin.auth().getUser(uid);
        const currentClaims = user.customClaims || {};
        const isAdmin = currentClaims.role === 'admin';

        if (isAdmin && !enabled) {
            throw new HttpsError('permission-denied', 'Two-Factor Authentication is mandatory for administrators.');
        }

        // Update user claims with mfaEnabled preference
        await admin.auth().setCustomUserClaims(uid, {
            ...currentClaims,
            mfaEnabled: enabled,
            is2FAVerified: !enabled // If disabling, immediately mark as verified. If enabling, mark as unverified.
        });

        logger.info(`User ${uid} toggled 2FA: ${enabled}`);
        return { success: true, enabled };

    } catch (error) {
        logger.error("Error toggling 2FA:", error);
        throw new HttpsError('internal', 'Failed to update security settings.');
    }
});

/**
 * Security: Revoke All Sessions
 * - Revokes refresh tokens for the user.
 * - Resets 2FA verification status to ensure fresh login.
 */
export const logoutAllDevices = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = request.data?.targetUid || request.auth.uid;
    const isSelf = uid === request.auth.uid;
    const isAdmin = request.auth.token.role === 'admin';

    if (!isSelf && !isAdmin) {
        throw new HttpsError('permission-denied', 'You do not have permission to log out this user.');
    }

    try {
        // 1. Revoke all refresh tokens for the user
        await admin.auth().revokeRefreshTokens(uid);

        // 2. Clear 2FA verification status so they must re-verify on next login
        const user = await admin.auth().getUser(uid);
        const currentClaims = user.customClaims || {};
        await admin.auth().setCustomUserClaims(uid, {
            ...currentClaims,
            is2FAVerified: false
        });

        // 3. Delete session tracking documents in Firestore
        const db = admin.firestore();
        const sessionsSnapshot = await db.collection('sessions').where('uid', '==', uid).get();
        const batch = db.batch();
        sessionsSnapshot.docs.forEach((doc) => {
            batch.set(doc.ref, {
                isActive: false,
                isCurrent: false,
                loggedOutAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSeen: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        await batch.commit();

        logger.info(`Sessions revoked for user ${uid} (Requested by: ${request.auth.uid})`);
        return { success: true, message: "All sessions have been revoked." };

    } catch (error: any) {
        logger.error("Error revoking sessions:", error);
        throw new HttpsError('internal', 'Failed to revoke sessions.');
    }
});

export const createGoogleMeet = onCall(async (request: any) => {
    const { google } = await import("googleapis");
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const summary = request.data.summary as string | undefined;
    const description = request.data.description as string | undefined;
    const start = request.data.start as string | undefined;
    const end = request.data.end as string | undefined;

    const ORGANIZER_EMAIL = "projects@uxdlab.us";

    try {
        const credentials = {
            client_email: "uxdcrm@ethereal-atlas-487312-p0.iam.gserviceaccount.com",
            private_key: "-----BEGIN PRIVATE KEY-----\n" +
                "MIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQDTf/9Z/zvGYPRu\n" +
                "dswL+/Yhi99y0vjRNyCVw59pg0sY1G8VJre4C507T6DPTQyJRa5ZZXfnuO+UR6a7\n" +
                "7Khl/yRIuge5kPzQZFQ8RpuwhZfW0WU3iI9prEEojJPrHvf9G4HM6EHHVu8/4Vel\n" +
                "BIPA43ibNPIk4KdSxev/FagM1nHjkBpwXOOu0vNPyFde1/uu+JJ2uEmLKBZPhfke\n" +
                "C34hHsjGHrqGpI7CkctQPsW8JtzeghBWAmlzS/Pvg6Y4xe4YtoebCZZDph7puxS9\n" +
                "h6sjbmBV+OUfYuEtQJKTjgukBRdHADihcIJybsDIPOS37AbgtdbKG9RP1WTULQhz\n" +
                "X4n6d2nvAgMBAAECgf8p4uLJCamzU00VYD5vVF2EFBXf9IHsIH7TkJ20x8vK0keU\n" +
                "AmPGj1MUUmQGqiIeQMgtH2tS+QB5qh105xzZFmHMa9gbzoF2XZuEVHeA/idg4+RB\n" +
                "aBb+8Df3T9/7lwzsYGyhQcSSAr8sASgNn/DeXC5s9PXMixfLZmc9A/NdyrQp3Opd\n" +
                "2i29pYCHeecVWVPicl9GojV23f247ZCo5yIKQ12AYGICltOb4lTy8kT44yxOZH3p\n" +
                "26T6FauWdW0WmJFa58HnWD1eLqXCHi8QKIbe9h9N/9RHIuvgY6KexCobk7SKzJ+p\n" +
                "nB9Bft2UMRcgg0E8NFZzbYeYbHbxKcJRQu7DnskCgYEA76bzD7UHjECd5G1EkjYa\n" +
                "VElWze1xUKtQET5u5miyjhWEo5jQ9bd6WbE7QWGs59EbvZe9z4y0zxv+ks73gl+K\n" +
                "IDSfHMXcD49JGkBLqVj+4GzKTYclJpCcFWaCYvD+yFK7Rvlj8AnRlxq29af0bPzx\n" +
                "0z2c/uBY2QAKJ8FjWAaaJakCgYEA4e1tIkZqvoj2yPxsefc63R2y2o2tZ0WxLBnX\n" +
                "M4b1iycMyb3/2KydjLhe0QJU3lzY88kf9Bt2FdFal3fVNO7U/NBw0cptlHNcjwjj\n" +
                "MJoFf5O9UQT5kSRqXNAhcs2Tn6V6IlKL5GF0qQyqcb6oazG7D+SHAsMJHm6BS1V6\n" +
                "rglPIdcCgYAJB0we6l4HbaPFKEyuCXXCeSTZCzn6pQmWLLj22zjm226szyQILcph\n" +
                "OKkX1Hs0HI+j++R9vjpNlytnEn8GnVzRy8m2xsl8mJRTddqj3aN0hwS0GQRQSKBo\n" +
                "ufzth1DB8UP274xRTb1kqO/9nz85H+poX+jbPU57lmHLj6CTf2QtSQKBgBBjerEr\n" +
                "zn53zP8TYIMQbhKwHtM/x75gDdQXI8c3GQS5FnJj9/UtwFf+39Hli2Z98bbtdgXt\n" +
                "IAnBIAMwzCSE1qpoLGbrejt0ithNWr2hzphMjUUdSUVAEP8eke6T/wtro4pt1nwA\n" +
                "ncfNhWeu3uS3vMwQVcLbhwPQHEzsrHOHdVgNAoGAUiNrvzLyh4F1P1O+pv9irzZb\n" +
                "JEeuWf0HO4fJIGwfuyOwQTT7cltd+I8IzYMg/ePevkyhaNnuZVa8C2vL4/4373Ni\n" +
                "JNybuDQgmhhf2wHQ/UbzOUzRKMQj5Emabj0kzhQ7Ecs0XSrjQc0IkS1JxA+PDqEC\n" +
                "/yEBeflY/x/JfseMX6o=\n-----END PRIVATE KEY-----\n",
        };

        const event: any = {
            summary: summary || undefined,
            description: description || undefined,
            start: { dateTime: start || new Date().toISOString(), timeZone: 'UTC' },
            end: { dateTime: end || new Date(Date.now() + 3600000).toISOString(), timeZone: 'UTC' },
            conferenceData: { createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
        };

        let meetLink: string | undefined;

        try {
            const auth = new google.auth.JWT({
                email: credentials.client_email,
                key: credentials.private_key,
                scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
                subject: ORGANIZER_EMAIL
            });
            const calendar = google.calendar({ version: 'v3', auth: auth as any });
            const resp = await calendar.events.insert({
                calendarId: ORGANIZER_EMAIL,
                requestBody: event,
                conferenceDataVersion: 1,
            });
            meetLink = (resp.data.hangoutLink || resp.data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri) || undefined;
        } catch (error: any) {
            if (error.message?.includes('unauthorized_client') || error.message?.includes('unauthorized')) {
                logger.warn("Domain-Wide Delegation failed, falling back to service account primary calendar.");
                const authFallback = new google.auth.JWT({
                    email: credentials.client_email,
                    key: credentials.private_key,
                    scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
                });
                const calendarFallback = google.calendar({ version: 'v3', auth: authFallback as any });
                const respFallback = await calendarFallback.events.insert({
                    calendarId: 'primary',
                    requestBody: event,
                    conferenceDataVersion: 1,
                });
                meetLink = (respFallback.data.hangoutLink || respFallback.data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri) || undefined;
            } else {
                throw error;
            }
        }

        if (!meetLink) throw new Error("Could not generate meet link.");
        return { meetLink };

    } catch (error: any) {
        logger.error("Final Meet Error:", error);
        throw new HttpsError('internal', `Failed to create meeting: ${error.message}`);
    }
});

// ... imports
import { onObjectFinalized } from "firebase-functions/v2/storage";

// Helper: Process text with AI to extract tasks (Reused logic)
async function extractTasksAI(text: string): Promise<{ task: string, description: string }[]> {
    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `
        You are a Project Management Specialist AI.
        Identify specific, actionable tasks from the text below.
        Format each task as a concise, professional title with a brief description.
        Return ONLY a valid JSON array of objects: [{"task": "title", "description": "desc"}].

        Rough Text:
        "${text}"
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        logger.error("AI Task Extraction Helper Failed:", error);
        return [];
    }
}

// Helper: Generate Meeting Summary
async function generateMeetingSummaryAI(text: string): Promise<string> {
    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `
        You are an Executive Assistant AI.
        Summarize the key points, decisions, and outcomes of this meeting transcript.
        Strictly provide a 4-line summary. No more, no less.
        Keep it professional, concise, and actionable.
        Return ONLY the summary text (markdown supported).

        Transcript:
        "${text}"
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Summary generation failed.";
    } catch (error) {
        logger.error("AI Summary Helper Failed:", error);
        return "Summary could not be generated.";
    }
}

/**
 * Trigger: When a meeting recording is uploaded to Cloud Storage.
 * Path: projects/{projectId}/meetings/{meetingId}/recording
 */
export const processMeetingRecording = onObjectFinalized({ region: "us-east1", cpu: 2, memory: "1GiB", timeoutSeconds: 540 }, async (event) => {
    const { SpeechClient } = await import("@google-cloud/speech");
    const speechClient = new SpeechClient();
    const file = event.data;
    const filePath = file.name; // e.g. projects/projectId/meetings/meetingId/recording_12345.mp3

    // 1. Validate Path Pattern
    if (!filePath.includes('meetings/') || !filePath.includes('recording')) {
        return; // Not a meeting recording
    }

    const parts = filePath.split('/');
    // projects/projectId/meetings/meetingId/filename
    // parts[0] = "projects"
    // parts[1] = projectId
    // parts[2] = "meetings" 
    // parts[3] = meetingId

    if (parts.length < 4) return;

    const projectId = parts[1];
    const meetingId = parts[3];

    logger.info(`Processing meeting recording for Project: ${projectId}, Meeting: ${meetingId}`);

    const gcsUri = `gs://${file.bucket}/${filePath}`;
    const contentType = file.contentType;

    // 2. Transcribe Audio
    try {
        const audio = { uri: gcsUri };

        // Detect encoding based on Content-Type or assume simplistic defaults
        let config: any = {
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
            model: 'video', // Best for meetings
            useEnhanced: true,
        };

        if (contentType === 'audio/flac') {
            config.encoding = 'FLAC';
        } else if (contentType === 'audio/wav' || contentType === 'audio/x-wav') {
            config.encoding = 'LINEAR16';
        } else if (contentType === 'audio/mp3' || contentType === 'audio/mpeg' || contentType === 'audio/m4a' || contentType === 'video/mp4') {
            config.encoding = 'MP3';
            // config.sampleRateHertz = 16000; // Let API infer for MP3/AAC containers
        } else if (contentType === 'audio/webm' || contentType === 'video/webm') {
            config.encoding = 'WEBM_OPUS';
            config.sampleRateHertz = 48000; // Standard for WebM
        }

        const request = {
            audio: audio,
            config: config,
        };

        logger.info(`Starting transcription for ${gcsUri} with config:`, config);

        // Use LongRunningRecognize for meetings > 1 min
        const [operation] = await speechClient.longRunningRecognize(request as any);
        const [response]: any = await operation.promise();

        const transcription = response.results
            ?.map((result: any) => result.alternatives[0].transcript)
            .join('\n');

        if (!transcription) {
            logger.warn("Transcription yielded empty result.");
            return;
        }

        logger.info("Transcription complete. Extracting insights...");

        // 3. AI Processing
        const [tasks, summary] = await Promise.all([
            extractTasksAI(transcription),
            generateMeetingSummaryAI(transcription)
        ]);

        // 4. Update Firestore
        // We now use a subcollection 'meetings' instead of a root array.
        const meetingRef = admin.firestore()
            .collection('projects').doc(projectId)
            .collection('meetings').doc(meetingId);

        await meetingRef.set({
            transcription: transcription,
            tasks: tasks,
            notes: summary, // Update notes/summary with AI summary
            transcriptionStatus: 'completed',
            recordingUrl: file.mediaLink || gcsUri, // Store link if useful
            lastAIProcessedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        logger.info("Meeting insights updated successfully in subcollection.");

        logger.info("Meeting insights updated successfully.");

    } catch (error) {
        logger.error("Error processing meeting recording:", error);
    }
});


/**
 * Sync Meeting Data from Google Meet API
 * - Fetches Transcript
 * - Processes with AI
 * - Updates Firestore
 */
export const syncMeetingData = onCall({ cors: true }, async (request) => {
    const { google } = await import("googleapis");
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { projectId, meetingId, meetLink } = request.data;

    if (!projectId || !meetingId || !meetLink) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    // Extract meeting code
    const meetingCodeMatch = meetLink.match(/meet\.google\.com\/([a-z]+-[a-z]+-[a-z]+)/);
    if (!meetingCodeMatch) {
        // Fallback: maybe the link IS the code
        if (!meetLink.match(/^[a-z]+-[a-z]+-[a-z]+$/)) {
            throw new HttpsError('invalid-argument', 'Invalid Google Meet link or code.');
        }
    }
    const meetingCode = meetingCodeMatch ? meetingCodeMatch[1] : meetLink;
    const spaceName = `spaces/${meetingCode}`;

    const ORGANIZER_EMAIL = "projects@uxdlab.us";

    try {
        const credentials = {
            client_email: "uxdcrm@ethereal-atlas-487312-p0.iam.gserviceaccount.com",
            private_key: "-----BEGIN PRIVATE KEY-----\n" +
                "MIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQDTf/9Z/zvGYPRu\n" +
                "dswL+/Yhi99y0vjRNyCVw59pg0sY1G8VJre4C507T6DPTQyJRa5ZZXfnuO+UR6a7\n" +
                "7Khl/yRIuge5kPzQZFQ8RpuwhZfW0WU3iI9prEEojJPrHvf9G4HM6EHHVu8/4Vel\n" +
                "BIPA43ibNPIk4KdSxev/FagM1nHjkBpwXOOu0vNPyFde1/uu+JJ2uEmLKBZPhfke\n" +
                "C34hHsjGHrqGpI7CkctQPsW8JtzeghBWAmlzS/Pvg6Y4xe4YtoebCZZDph7puxS9\n" +
                "h6sjbmBV+OUfYuEtQJKTjgukBRdHADihcIJybsDIPOS37AbgtdbKG9RP1WTULQhz\n" +
                "X4n6d2nvAgMBAAECgf8p4uLJCamzU00VYD5vVF2EFBXf9IHsIH7TkJ20x8vK0keU\n" +
                "AmPGj1MUUmQGqiIeQMgtH2tS+QB5qh105xzZFmHMa9gbzoF2XZuEVHeA/idg4+RB\n" +
                "aBb+8Df3T9/7lwzsYGyhQcSSAr8sASgNn/DeXC5s9PXMixfLZmc9A/NdyrQp3Opd\n" +
                "2i29pYCHeecVWVPicl9GojV23f247ZCo5yIKQ12AYGICltOb4lTy8kT44yxOZH3p\n" +
                "26T6FauWdW0WmJFa58HnWD1eLqXCHi8QKIbe9h9N/9RHIuvgY6KexCobk7SKzJ+p\n" +
                "nB9Bft2UMRcgg0E8NFZzbYeYbHbxKcJRQu7DnskCgYEA76bzD7UHjECd5G1EkjYa\n" +
                "VElWze1xUKtQET5u5miyjhWEo5jQ9bd6WbE7QWGs59EbvZe9z4y0zxv+ks73gl+K\n" +
                "IDSfHMXcD49JGkBLqVj+4GzKTYclJpCcFWaCYvD+yFK7Rvlj8AnRlxq29af0bPzx\n" +
                "0z2c/uBY2QAKJ8FjWAaaJakCgYEA4e1tIkZqvoj2yPxsefc63R2y2o2tZ0WxLBnX\n" +
                "M4b1iycMyb3/2KydjLhe0QJU3lzY88kf9Bt2FdFal3fVNO7U/NBw0cptlHNcjwjj\n" +
                "MJoFf5O9UQT5kSRqXNAhcs2Tn6V6IlKL5GF0qQyqcb6oazG7D+SHAsMJHm6BS1V6\n" +
                "rglPIdcCgYAJB0we6l4HbaPFKEyuCXXCeSTZCzn6pQmWLLj22zjm226szyQILcph\n" +
                "OKkX1Hs0HI+j++R9vjpNlytnEn8GnVzRy8m2xsl8mJRTddqj3aN0hwS0GQRQSKBo\n" +
                "ufzth1DB8UP274xRTb1kqO/9nz85H+poX+jbPU57lmHLj6CTf2QtSQKBgBBjerEr\n" +
                "zn53zP8TYIMQbhKwHtM/x75gDdQXI8c3GQS5FnJj9/UtwFf+39Hli2Z98bbtdgXt\n" +
                "IAnBIAMwzCSE1qpoLGbrejt0ithNWr2hzphMjUUdSUVAEP8eke6T/wtro4pt1nwA\n" +
                "ncfNhWeu3uS3vMwQVcLbhwPQHEzsrHOHdVgNAoGAUiNrvzLyh4F1P1O+pv9irzZb\n" +
                "JEeuWf0HO4fJIGwfuyOwQTT7cltd+I8IzYMg/ePevkyhaNnuZVa8C2vL4/4373Ni\n" +
                "JNybuDQgmhhf2wHQ/UbzOUzRKMQj5Emabj0kzhQ7Ecs0XSrjQc0IkS1JxA+PDqEC\n" +
                "/yEBeflY/x/JfseMX6o=\n-----END PRIVATE KEY-----\n",
        };

        const auth = new google.auth.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: [
                'https://www.googleapis.com/auth/meetings.conferenceRecords.readonly',
                'https://www.googleapis.com/auth/meetings.space.readonly'
            ],
            subject: ORGANIZER_EMAIL
        });

        // @ts-ignore
        const meetService = google.meet({ version: 'v2', auth: auth }) as any;

        // 1. List Conferences (Manual filter by space for safety)
        const resp = await meetService.conferenceRecords.list({
            pageSize: 50 // Limit to recent 50
        });

        const targetConference = (resp.data.conferenceRecords || []).find((r: any) => r.space === spaceName);

        if (!targetConference) {
            throw new HttpsError('not-found', "No conference record found. The meeting might not have ended, or no recording/transcript exists.");
        }

        // 2. Check for Transcripts
        const transcriptsResp = await meetService.conferenceRecords.transcripts.list({
            parent: targetConference.name
        });

        const transcripts = transcriptsResp.data.transcripts || [];
        if (transcripts.length === 0) {
            throw new HttpsError('not-found', "Conference found, but no transcripts are available.");
        }

        const transcriptName = transcripts[0].name;

        // 3. Get Participants Map
        const participantsResp = await meetService.conferenceRecords.participants.list({
            parent: targetConference.name
        });
        const participantMap: Record<string, string> = {};
        (participantsResp.data.participants || []).forEach((p: any) => {
            if (p.name) {
                // Try user (signed in) or standard user
                const displayName = p.user?.displayName || p.signedinUser?.displayName || "Unknown";
                participantMap[p.name] = displayName;
            }
        });

        // 4. Get Transcript Entries
        const entriesResp = await meetService.conferenceRecords.transcripts.entries.list({
            parent: transcriptName,
            pageSize: 5000 // Get all
        });

        const entries = entriesResp.data.entries || [];
        const fullTranscriptText = entries
            .map((e: any) => {
                const name = (e.participant && participantMap[e.participant]) || "Unknown Speaker";
                return `${name}: ${e.text}`;
            })
            .join('\n');

        if (!fullTranscriptText) {
            throw new HttpsError('not-found', "Transcript file was empty.");
        }

        // 5. AI Processing
        const [tasks, summary] = await Promise.all([
            extractTasksAI(fullTranscriptText),
            generateMeetingSummaryAI(fullTranscriptText)
        ]);

        // 6. Update Firestore
        // We now use a subcollection 'meetings' instead of a root array.
        const meetingRef = admin.firestore()
            .collection('projects').doc(projectId)
            .collection('meetings').doc(meetingId);

        await meetingRef.set({
            transcription: fullTranscriptText,
            tasks: tasks,
            notes: summary,
            transcriptionStatus: 'completed',
            lastSyncedAt: new Date().toISOString()
        }, { merge: true });

        return { success: true, message: "Meeting synced successfully." };

    } catch (error: any) {
        logger.error("Sync Meeting Error:", error);

        if (error.message?.includes('unauthorized_client')) {
            throw new HttpsError('permission-denied', 'Service Account missing Domain-Wide Delegation for Meet scopes. Please configure in Google Workspace Admin.');
        }

        if (error.message?.includes('invalid_grant')) {
            throw new HttpsError('permission-denied', 'Invalid Service Account credentials or scopes.');
        }

        throw new HttpsError('internal', error.message || "Failed to sync meeting.");
    }
});

// Helper: Generate Ack Email Template
function generateAckEmailTemplate(name: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank you for contacting UXDLAB</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px;">
                <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
                    Thank you for reaching out, ${name}!
                </h1>
                
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                    We have successfully received your inquiry and our team has been notified. 
                    Someone from UXDLAB will review your details and connect with you shortly.
                </p>

                <p style="margin: 0 0 32px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                    We look forward to the possibility of working together and making something amazing!
                </p>

                <!-- Divider -->
                <div style="height: 1px; background-color: #e5e7eb; margin: 40px 0 32px 0;"></div>

                <!-- Footer -->
                <table role="presentation" style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0;">
                            <!-- UXDLab Logo -->
                            <table role="presentation" style="border-collapse: collapse; margin-bottom: 16px;">
                                <tr>
                                    <td style="padding: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -2px; vertical-align: bottom;">u</td>
                                    <td style="padding: 0; vertical-align: bottom;">
                                        <table role="presentation" style="border-collapse: collapse;">
                                            <tr>
                                                <td align="center" style="padding: 0; line-height: 1;">
                                                    <span style="display: inline-block; width: 6px; height: 6px; background-color: #ec4899; border-radius: 50%;">&nbsp;</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -2px;">x</td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td style="padding: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -2px; vertical-align: bottom;">dlab</td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #111827;">
                                UXDLAB Softwares Pvt. Ltd.
                            </p>
                            <p style="margin: 0; font-size: 13px; color: #6b7280;">
                                This is an automated acknowledgment.
                            </p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>
</html>
`;
}

/**
 * Endpoint for website unauthenticated contact forms.
 */
export const submitContactForm = onRequest({ cors: true }, async (req, res) => {
    // Check if it's a POST request
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { name, email, subject, message, phone, company, budget, timeline } = req.body;

    // Collect all fields into a structured email
    let contentHtml = `<h3>New Inquiry from Your Website</h3>`;
    let contentText = `New Inquiry from Your Website\n\n`;

    if (name) { contentHtml += `<p><strong>Name:</strong> ${name}</p>`; contentText += `Name: ${name}\n`; }
    if (company) { contentHtml += `<p><strong>Company:</strong> ${company}</p>`; contentText += `Company: ${company}\n`; }
    if (email) { contentHtml += `<p><strong>User Email:</strong> ${email}</p>`; contentText += `Email: ${email}\n`; }
    if (phone) { contentHtml += `<p><strong>Phone:</strong> ${phone}</p>`; contentText += `Phone: ${phone}\n`; }
    if (budget) { contentHtml += `<p><strong>Budget:</strong> ${budget}</p>`; contentText += `Budget: ${budget}\n`; }
    if (timeline) { contentHtml += `<p><strong>Timeline:</strong> ${timeline}</p>`; contentText += `Timeline: ${timeline}\n`; }
    if (subject) { contentHtml += `<p><strong>Subject:</strong> ${subject}</p>`; contentText += `Subject: ${subject}\n`; }

    contentHtml += `<br/><p><strong>Message:</strong></p><p>${message ? message.replace(/\\n/g, '<br>') : ''}</p>`;
    contentText += `\nMessage:\n${message || ''}`;

    try {
        await sendEmailHelper({
            to: "rajeev@uxdlab.us",
            replyTo: email,
            subject: subject || `New Contact Message from ${name}`,
            html: contentHtml,
            text: contentText
        });

        // Send auto-acknowledgment email
        if (email) {
            await sendEmailHelper({
                to: email,
                subject: `Thank you for contacting UXDLAB`,
                html: generateAckEmailTemplate(name || 'there'),
                text: `Hi ${name || 'there'},\n\nThank you for reaching out! We have successfully received your inquiry and our team has been notified. Someone from UXDLAB will connect with you shortly.\n\nBest Regards,\nUXDLAB Softwares Pvt. Ltd.`
            });
        }

        res.status(200).json({ success: true, message: "Email sent successfully!" });
    } catch (error: any) {
        logger.error("Error sending website contact email:", error);
        res.status(500).json({ success: false, error: "Failed to send email." });
    }
});

/**
 * Trigger: When a new notification is added to Firestore.
 * Goal: Send a push notification (FCM) to targeted users.
 */
export const sendFCMOnNotification = onDocumentCreated("notifications/{notificationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const notification = snapshot.data();
    const title = notification.title || 'New Notification';
    const body = notification.description || '';
    const forRole = notification.forRole;
    const forUserId = notification.forUserId;

    try {
        const tokens: string[] = [];

        if (forUserId) {
            const userDoc = await admin.firestore().collection('users').doc(forUserId).get();
            const fcmToken = userDoc.data()?.fcmToken;
            if (fcmToken) tokens.push(fcmToken);
        } else {
            const usersSnapshot = await admin.firestore().collection('users').get();
            for (const doc of usersSnapshot.docs) {
                const data = doc.data();
                if (!data.fcmToken) continue;

                let includeUser = false;
                if (!forRole) {
                    includeUser = true;
                } else {
                    try {
                        const userRecord = await admin.auth().getUser(doc.id);
                        if (userRecord.customClaims?.role === forRole) {
                            includeUser = true;
                        }
                    } catch (err) {
                        logger.warn(`Could not fetch auth user for Firestore user doc ${doc.id}`);
                    }
                }

                if (includeUser) {
                    tokens.push(data.fcmToken);
                }
            }
        }

        if (tokens.length > 0) {
            const message = {
                notification: {
                    title: title,
                    body: body
                },
                tokens: tokens
            };
            const response = await admin.messaging().sendEachForMulticast(message);
            logger.info(`FCM Pushed to ${response.successCount} devices, failures: ${response.failureCount}`);
        } else {
            logger.info('No relevant FCM tokens found for this notification.');
        }

    } catch (error) {
        logger.error('Error sending FCM notification:', error);
    }
});

/**
 * Scheduled job that runs every 6 hours to process lead automation.
 */
export const processLeadAutomation = onSchedule("every 1 minutes", async (event) => {
    logger.info("Starting lead automation task...");
    const now = new Date();

    try {
        const leadsSnapshot = await admin.firestore().collection('leads')
            .where('automationEnrolled', '==', true)
            .get();

        logger.info(`Processing ${leadsSnapshot.size} enrolled leads.`);

        // Cache settings to avoid fetching multiple times
        const settingsCache: { [ownerId: string]: any } = {};

        for (const leadDoc of leadsSnapshot.docs) {
            const leadData = leadDoc.data();

            // Determine the owner of the lead
            const ownerId = leadData.assignedTo || leadData.addedBy;
            if (!ownerId) {
                logger.warn(`Lead ${leadDoc.id} has no assigned owner, skipping automation.`);
                continue;
            }

            // Get settings for this owner
            if (settingsCache[ownerId] === undefined) {
                const settingsDoc = await admin.firestore().collection('settings').doc(`lead_automation_${ownerId}`).get();
                settingsCache[ownerId] = settingsDoc.exists ? settingsDoc.data() : null;
            }

            const settings = settingsCache[ownerId];

            if (!settings) {
                logger.info(`No lead automation settings found for owner ${ownerId}.`);
                continue;
            }

            if (!settings.isAiEnabled) {
                logger.info(`AI Automation disabled for owner ${ownerId}.`);
                continue;
            }

            const steps = settings.steps || [];
            if (steps.length === 0) {
                logger.info(`No automation steps defined for owner ${ownerId}.`);
                continue;
            }

            const stepIndex = leadData.automationStepIndex || 0;

            if (stepIndex >= steps.length) {
                await leadDoc.ref.update({ automationEnrolled: false });
                continue;
            }

            const currentStep = steps[stepIndex];
            const delayInMinutes = parseInt(currentStep.delay || "1440"); // Default to 1 day (1440 mins) if not set

            const baselineDateStr = (stepIndex === 0)
                ? leadData.automationEnrolledAt
                : leadData.lastAutomationActionDate;

            if (!baselineDateStr) {
                await leadDoc.ref.update({ automationEnrolledAt: now.toISOString() });
                continue;
            }

            const baselineDate = new Date(baselineDateStr);
            const timeDiff = now.getTime() - baselineDate.getTime();
            const minutesDiff = timeDiff / (1000 * 60);

            if (minutesDiff >= delayInMinutes) {
                logger.info(`Executing step ${stepIndex + 1} for lead ${leadData.name} (${leadDoc.id}). Delay reached: ${minutesDiff.toFixed(1)}/${delayInMinutes} mins.`);

                let emailContent = "";
                let senderName = "the UXDLAB Team";
                const ownerId = leadData.addedBy || leadData.assignedTo;

                if (ownerId && typeof ownerId === 'string' && ownerId.length > 5) {
                    try {
                        const empSnap = await admin.firestore().collection('employees').doc(ownerId).get();
                        if (empSnap.exists) {
                            senderName = empSnap.data()?.name || senderName;
                        }
                    } catch (e) {
                        logger.warn(`Failed to fetch employee name for ${ownerId}`);
                    }
                }

                if (currentStep.mode === 'ai') {
                    const recentHistory = (leadData.receivedEmails || []).concat(leadData.sentEmails || [])
                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 5);
                    const historyContext = recentHistory.map((m: any) => `${m.sender}: ${m.content}`).join("\n---\n");
                    emailContent = await generateAIAutomationFollowUp(currentStep.content, leadData, historyContext, senderName);
                } else {
                    emailContent = currentStep.content;
                }

                try {
                    // Fetch signature logic
                    let signatureHtml = "";
                    const signatureOwnerId = leadData.addedBy || leadData.assignedTo;
                    if (signatureOwnerId && typeof signatureOwnerId === 'string' && signatureOwnerId.length > 5) {
                        try {
                            const sigSnap = await admin.firestore().collection('emailSignatures').doc(signatureOwnerId).get();
                            if (sigSnap.exists) {
                                signatureHtml = sigSnap.data()?.signatureHtml || "";
                            }
                        } catch (sigErr) {
                            logger.warn(`Could not fetch signature for ${signatureOwnerId}`, sigErr);
                        }
                    }

                    if (!signatureHtml) {
                        // Exactly match the professional signature from src/utils/emailTemplate.ts
                        signatureHtml = `
                        <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                            <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; font-style: italic;">Thanks & Regards</p>
                            
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
                                ${senderName}
                            </p>
                            <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                                UXDLAB Software Pvt. Ltd.
                            </p>
                            <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
                                9th Floor, A-27, Block A, Industrial Area,<br>
                                Sector 62, Noida, Uttar Pradesh 201309
                            </p>
                            <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b7280;">
                                Contact: +91 9199885566
                            </p>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">
                                Email: <a href="mailto:project@uxdlab.us" style="color: #2563eb; text-decoration: none;">project@uxdlab.us</a>
                            </p>
                            <p style="margin: 4px 0 0 0; font-size: 13px;">
                                <a href="https://uxdlab.us/" style="color: #2563eb; text-decoration: none;">https://uxdlab.us/</a>
                            </p>
                        </div>`;
                    }

                    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #374151; line-height: 1.6; background-color: #ffffff;">
    <div style="font-size: 16px;">
        ${emailContent.replace(/\n/g, '<br>')}
    </div>
    <div style="margin-top: 32px;">
        ${signatureHtml}
    </div>
</body>
</html>`;

                    await sendEmailHelper({
                        to: leadData.email,
                        subject: `Following up from UXDLAB: ${leadData.name}`,
                        html: htmlBody,
                    });

                    await leadDoc.ref.update({
                        automationStepIndex: stepIndex + 1,
                        lastAutomationActionDate: now.toISOString(),
                        lastContactedDate: now.toISOString(),
                        sentEmails: admin.firestore.FieldValue.arrayUnion({
                            sender: "UXDLAB AI",
                            subject: `Following up from UXDLAB: ${leadData.name}`,
                            content: emailContent,
                            date: now.toISOString(),
                            type: 'automation'
                        })
                    });

                    await admin.firestore().collection('lead_automation_logs').add({
                        leadId: leadDoc.id,
                        leadName: leadData.name,
                        leadEmail: leadData.email,
                        ownerId: ownerId,
                        message: `Email Sent: ${leadData.name}`,
                        detail: `${currentStep.mode === 'ai' ? "AI Generated" : "Manual Step"} follow-up sent to ${leadData.email}`,
                        status: 'success',
                        type: currentStep.mode,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                } catch (err: any) {
                    logger.error(`Failed to send automation email to ${leadData.email}:`, err);
                    await admin.firestore().collection('lead_automation_logs').add({
                        leadId: leadDoc.id,
                        leadName: leadData.name,
                        leadEmail: leadData.email,
                        ownerId: ownerId,
                        message: `Failed: ${leadData.name}`,
                        detail: `Error sending to ${leadData.email}: ${err.message || "Unknown error"}`,
                        status: 'error',
                        type: 'system',
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else {
                logger.info(`Skipping lead ${leadData.name} (${leadDoc.id}): Waiting for delay. Current: ${minutesDiff.toFixed(1)} mins, Target: ${delayInMinutes} mins. (Step ${stepIndex + 1})`);
            }
        }
    } catch (error) {
        logger.error("Global error in lead automation task:", error);
    }
});

/**
 * Helper to generate AI follow-up based on instructions and context.
 */
async function generateAIAutomationFollowUp(instructions: string, lead: any, historyContext: string, senderName: string) {
    const apiKey = await getAiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

    const prompt = `
        You are a professional AI Lead Engagement Specialist for "UXDLAB Softwares Pvt. Ltd.".
        
        Instructions for this email:
        ${instructions}
        
        Detailed Lead Context:
        - Lead Name: ${lead.name || "N/A"}
        - Company: ${lead.company || "N/A"} (${lead.website || "No website"})
        - Job Title: ${lead.jobTitle || "N/A"}
        - Industry: ${lead.industry || "N/A"}
        - Location: ${lead.city ? lead.city + ", " : ""}${lead.country || "N/A"}
        - Local Timezone: ${lead.timeZone || "Unknown"}
        - Company Size: ${lead.companySize || "N/A"}
        - Pain Points: ${lead.painPoints || "Not specified"}
        - Requirements: ${lead.requirements || "Not specified"}
        
        Scraped Intelligence / Research Data:
        ${lead.intelligence || "No additional research data available."}
        
        Recent Conversation History:
        ${historyContext || "No previous history found."}
        
        Your Task:
        Draft a high-converting, personalized, professional follow-up email.
        - STRICTLY follow the instructions provided.
        - Reference the lead's industry, pain points, or research data smoothly to show personalization.
        - Consider their timezone if suggesting a time (be generic if time is not specific).
        - Maintain a helpful, professional, and consultative tone.
        - Do not use generic placeholders.
        - Sign off the message with "Sincerely," or "Best regards," followed by the name: "${senderName}".
        - The email should be concise, value-driven, and end with a clear but low-friction call to action.
    `;

    try {
        logger.info(`Generating AI Follow-up for ${lead.name || "Unknown Lead"}...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const responseText = await response.text();

        if (!response.ok) {
            logger.error("Gemini API Error:", { status: response.status, body: responseText });
            return `Draft: Hello ${lead.name || "there"}, following up on our project. Let me know if you need any assistance. (AI generated fallback)`;
        }

        let data: any;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            logger.error("JSON Parse Error:", responseText);
            return "Hello, following up on our discussion. Please let me know if you have any questions.";
        }

        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
            logger.warn("Empty Gemini Response:", data);
            return "Hello, reached out to see if you had any updates. Best, UXDLAB Team.";
        }

        return textResponse;
    } catch (error: any) {
        logger.error("AI Generation Failure:", error);
        return `Draft: Hello ${lead.name || "there"}, following up on our project. Let me know if you need any assistance.`;
    }
}

/**
 * Callable: Preview an AI automation step.
 */
export const previewAutomationStep = onCall({ cors: true }, async (request) => {
    logger.info("Previewing AI Automation Step", { data: request.data, auth: request.auth?.uid });
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { instructions, leadData, historyContext } = request.data;

    if (!instructions) {
        throw new HttpsError('invalid-argument', 'Instructions are required.');
    }

    try {
        const content = await generateAIAutomationFollowUp(instructions, leadData || { name: "Sample Client" }, historyContext || "", "the UXDLAB Team");
        logger.info("Preview generated successfully");
        return { content };
    } catch (err: any) {
        logger.error("Error in previewAutomationStep:", err);
        throw new HttpsError('internal', err.message || 'Failed to generate preview');
    }
});

/**
 * Callable: Seed Admin User.
 */
export const seedAdmin = onRequest(async (req, res) => {
    try {
        const email = "cshrey1234@gmail.com";
        const password = "123456789";

        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
            await admin.auth().updateUser(userRecord.uid, { password });
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                userRecord = await admin.auth().createUser({
                    email,
                    password,
                    displayName: "Admin User",
                });
            } else {
                throw error;
            }
        }

        // Set custom claims for admin
        await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });

        res.json({ success: true, message: "Admin seeded successfully", uid: userRecord.uid });
    } catch (error: any) {
        logger.error("Error seeding admin user:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// WHATSAPP BUSINESS CLOUD API INTEGRATION
// ============================================================

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";
// const META_APP_SECRET = process.env.META_APP_SECRET || "";

/**
 * Helper: Send a WhatsApp message via Meta Cloud API
 */
async function sendWhatsAppMessageHelper(options: {
    to: string;
    type: 'text' | 'template';
    text?: string;
    templateName?: string;
    templateLanguage?: string;
    templateComponents?: any[];
    phoneNumberId: string;
    accessToken: string;
}) {
    const axios = (await import("axios")).default;

    const url = `https://graph.facebook.com/v21.0/${options.phoneNumberId}/messages`;

    let messagePayload: any = {
        messaging_product: "whatsapp",
        to: options.to.replace(/[^0-9]/g, ''), // Strip non-numeric chars
    };

    if (options.type === 'text') {
        messagePayload.type = "text";
        messagePayload.text = { body: options.text };
    } else if (options.type === 'template') {
        messagePayload.type = "template";
        messagePayload.template = {
            name: options.templateName || "hello_world",
            language: { code: options.templateLanguage || "en_US" },
            components: options.templateComponents || []
        };
    }

    try {
        const response = await axios.post(url, messagePayload, {
            headers: {
                'Authorization': `Bearer ${options.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        logger.info(`WhatsApp message sent to ${options.to}:`, response.data);
        return {
            success: true,
            messageId: response.data.messages?.[0]?.id,
            waId: response.data.contacts?.[0]?.wa_id
        };
    } catch (error: any) {
        logger.error("WhatsApp API Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error?.message || "Failed to send WhatsApp message");
    }
}

/**
 * Callable: Send WhatsApp message to a Lead
 * Used from LeadDetails -> WhatsApp tab
 */
export const sendWhatsAppMessage = onCall(
    {
        memory: "512MiB",
        timeoutSeconds: 60
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be logged in.');
        }

        const { to, message, leadId, leadName: _leadName, templateName, templateLanguage, templateComponents } = request.data;

        if (!to) {
            throw new HttpsError('invalid-argument', 'Phone number is required.');
        }

        const isTemplate = !!templateName;

        if (!isTemplate && !message) {
            throw new HttpsError('invalid-argument', 'Message text or template name is required.');
        }

        try {
            const result = await sendWhatsAppMessageHelper({
                to,
                type: isTemplate ? 'template' : 'text',
                text: message,
                templateName,
                templateLanguage,
                templateComponents,
                phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
                accessToken: META_ACCESS_TOKEN
            });

            // Log the message in the lead's Firestore document
            if (leadId) {
                const now = new Date().toISOString();
                const leadRef = admin.firestore().collection('leads').doc(leadId);

                const logEntry = {
                    id: `wa_${Date.now()}`,
                    type: 'whatsapp',
                    content: isTemplate ? `[Template: ${templateName}]` : message,
                    date: now,
                    sender: request.auth.token?.email || request.auth.token?.name || 'CRM User',
                    direction: 'outbound',
                    waMessageId: result.messageId,
                    status: 'sent'
                };

                await leadRef.update({
                    logs: admin.firestore.FieldValue.arrayUnion(logEntry),
                    lastContactedDate: now
                });

                logger.info(`WhatsApp message logged for lead ${leadId}`);
            }

            return { success: true, messageId: result.messageId };
        } catch (error: any) {
            logger.error("Error sending WhatsApp message:", error);
            throw new HttpsError('internal', error.message || 'Failed to send WhatsApp message');
        }
    }
);

/**
 * Callable: Send WhatsApp Project Update to Client
 * Used from DailyUpdates page
 */
export const sendWhatsAppProjectUpdate = onCall(
    {
        memory: "512MiB",
        timeoutSeconds: 60
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be logged in.');
        }

        const { to, message, projectId, projectName, clientName, clientId } = request.data;

        if (!to || !message) {
            throw new HttpsError('invalid-argument', 'Phone number and message are required.');
        }

        try {
            const result = await sendWhatsAppMessageHelper({
                to,
                type: 'text',
                text: message,
                phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
                accessToken: META_ACCESS_TOKEN
            });

            // Log to project's WhatsApp history
            if (projectId) {
                const now = new Date().toISOString();
                const projectRef = admin.firestore().collection('projects').doc(projectId);

                const waMessage = {
                    id: `wa_${Date.now()}`,
                    date: now,
                    sender: request.auth.token?.email || 'CRM User',
                    content: message,
                    direction: 'outbound',
                    waMessageId: result.messageId,
                    recipientPhone: to,
                    recipientName: clientName
                };

                await projectRef.update({
                    whatsappMessages: admin.firestore.FieldValue.arrayUnion(waMessage)
                });
            }

            // Log to client's WhatsApp history
            if (clientId) {
                const clientRef = admin.firestore().collection('clients').doc(clientId);
                const now = new Date().toISOString();

                const waMessage = {
                    id: `wa_${Date.now()}`,
                    date: now,
                    sender: request.auth.token?.email || 'CRM User',
                    content: message,
                    direction: 'outbound',
                    waMessageId: result.messageId,
                    projectName: projectName
                };

                await clientRef.update({
                    whatsappMessages: admin.firestore.FieldValue.arrayUnion(waMessage)
                });
            }

            return { success: true, messageId: result.messageId };
        } catch (error: any) {
            logger.error("Error sending WhatsApp project update:", error);
            throw new HttpsError('internal', error.message || 'Failed to send WhatsApp project update');
        }
    }
);

/**
 * HTTP Trigger: WhatsApp Webhook Endpoint (onRequest)
 * - GET: Meta verification handshake
 * - POST: Incoming messages, status updates
 */
export const whatsappWebhook = onRequest(
    {
        cors: true
    },
    async (req, res) => {
        // GET: Webhook verification from Meta
        if (req.method === 'GET') {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
                logger.info("WhatsApp webhook verified successfully");
                res.status(200).send(challenge);
                return;
            } else {
                logger.warn("WhatsApp webhook verification failed");
                res.status(403).send("Forbidden");
                return;
            }
        }

        // POST: Incoming webhook events
        if (req.method === 'POST') {
            try {
                const body = req.body;

                // Validate it's a WhatsApp event
                if (body?.object !== 'whatsapp_business_account') {
                    res.status(400).send("Not a WhatsApp event");
                    return;
                }

                const entries = body.entry || [];

                for (const entry of entries) {
                    const changes = entry.changes || [];

                    for (const change of changes) {
                        if (change.field !== 'messages') continue;
                        const value = change.value;

                        // Handle incoming messages
                        const messages = value.messages || [];
                        for (const msg of messages) {
                            const senderPhone = msg.from; // e.g., "919876543210"
                            const messageText = msg.text?.body || msg.type || '';
                            const messageId = msg.id;
                            const timestamp = msg.timestamp;

                            logger.info(`Incoming WhatsApp from ${senderPhone}: ${messageText}`);

                            // Find the contact name from WhatsApp data
                            const contactName = value.contacts?.[0]?.profile?.name || senderPhone;

                            // Try to find matching lead by phone number
                            const leadsSnapshot = await admin.firestore().collection('leads')
                                .where('phone', '>=', senderPhone.slice(-10))
                                .limit(5)
                                .get();

                            let matchedLead = false;
                            for (const doc of leadsSnapshot.docs) {
                                const leadPhone = doc.data().phone?.replace(/[^0-9]/g, '') || '';
                                if (leadPhone.includes(senderPhone.slice(-10)) || senderPhone.includes(leadPhone.slice(-10))) {
                                    // Match found
                                    const logEntry = {
                                        id: `wa_in_${Date.now()}`,
                                        type: 'whatsapp',
                                        content: messageText,
                                        date: new Date(Number(timestamp) * 1000).toISOString(),
                                        sender: contactName,
                                        direction: 'inbound',
                                        waMessageId: messageId
                                    };

                                    await doc.ref.update({
                                        logs: admin.firestore.FieldValue.arrayUnion(logEntry)
                                    });

                                    matchedLead = true;
                                    logger.info(`Matched incoming WhatsApp to lead: ${doc.id}`);
                                    break;
                                }
                            }

                            // Also try to match with clients
                            if (!matchedLead) {
                                const clientsSnapshot = await admin.firestore().collection('clients')
                                    .where('phone', '>=', senderPhone.slice(-10))
                                    .limit(5)
                                    .get();

                                for (const doc of clientsSnapshot.docs) {
                                    const clientPhone = doc.data().phone?.replace(/[^0-9]/g, '') || '';
                                    if (clientPhone.includes(senderPhone.slice(-10)) || senderPhone.includes(clientPhone.slice(-10))) {
                                        const waMessage = {
                                            id: `wa_in_${Date.now()}`,
                                            date: new Date(Number(timestamp) * 1000).toISOString(),
                                            sender: contactName,
                                            content: messageText,
                                            direction: 'inbound',
                                            waMessageId: messageId
                                        };

                                        await doc.ref.update({
                                            whatsappMessages: admin.firestore.FieldValue.arrayUnion(waMessage)
                                        });

                                        logger.info(`Matched incoming WhatsApp to client: ${doc.id}`);
                                        break;
                                    }
                                }
                            }
                        }

                        // Handle status updates (sent, delivered, read)
                        const statuses = value.statuses || [];
                        for (const status of statuses) {
                            logger.info(`WhatsApp status update: ${status.id} -> ${status.status}`);
                            // Could update message status in Firestore if needed
                        }
                    }
                }

                res.status(200).send("OK");
            } catch (error) {
                logger.error("Error processing WhatsApp webhook:", error);
                res.status(200).send("OK"); // Always return 200 to Meta
            }
            return;
        }

        res.status(405).send("Method not allowed");
    }
);

/**
                            styleNumber: opt.styleNumber || idx + 1,
                            caption: opt.caption || "",
                            imagePrompt: opt.imagePrompt || "",
                            // Native data URI for immediate rendering
                            imageUrl: base64 ? `data:image/png;base64,${base64}` : null,
                            isNative: true
                        };
                    } catch (imgErr: any) {
                        logger.error(`Variant ${idx} image failed:`, imgErr);
                        // Total fallback if native fails
                        return {
                            ...opt,
                            style: opt.style || `Style ${idx + 1}`,
                            imageUrl: null,
                            error: imgErr.message
                        };
                    }
                })
            );

            logger.info(`Successfully synthesized ${finalOptions.length} native posts.`);
            return { options: finalOptions };

        } catch (error: any) {
            logger.error("generateAIPost Native Cloud Function failed:", error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError(
                "internal",
                `Native creative synthesis failed: ${error.message}`
            );
        }
    }
);



/**
 * generateSocialPost: Production-ready Image Generation + Persistence
 * Exports to projects/{projectId}/posts
 */
export const generateSocialPost = onCall({
    memory: "2GiB",
    timeoutSeconds: 540,
}, async (request) => {
    // ── Auth guard ───────────────
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { 
        prompt, 
        projectId, 
        taskId, 
        platform = "Instagram", 
        aspectRatio = "1:1", 
        resolution = "2K", 
        referenceImage,
        referenceImages,
        firstFrame,
        lastFrame,
        isReel = false
    } = request.data;

    // Check required fields
    if (!prompt || !projectId) {
        throw new HttpsError("invalid-argument", 'Missing required arguments: prompt and projectId.');
    }

    const apiKey = await getAiApiKey();
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });


    try {
        logger.info(`Starting production content generation for project: ${projectId}, type: ${isReel ? 'Reel' : 'Image'}`);

        let downloadUrl = "";
        let filename = "";
        let postData: any = {};

        if (isReel) {
            // ── VIDEO GENERATION (VEO 3.1 REST API) ───────────────
            logger.info("Synthesizing Video via Veo 3.1 REST API...");
            const axios = (await import("axios")).default;
            
            const videoAspectRatio = (aspectRatio === '9:16' || aspectRatio === '16:9') ? aspectRatio : '9:16';
            
            // Map frontend resolution to Veo supported options
            let videoResolution = "1080p"; // sensible default for reels
            if (resolution) {
                const resLower = resolution.toLowerCase();
                if (resLower.includes('4k')) videoResolution = '4k';
                else if (resLower.includes('720')) videoResolution = '720p';
                else if (resLower.includes('1080')) videoResolution = '1080p';
            }

            const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning";
            
            // Build instance payload based on input mode
            // Rules: referenceImages CANNOT be used with image/lastFrame
            const instancePayload: any = { prompt: prompt };

            if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
                // Mode: Reference Images (up to 3 asset images)
                logger.info(`Using ${referenceImages.length} reference image(s) for video generation`);
                instancePayload.referenceImages = referenceImages.slice(0, 3).map((imgB64: string) => ({
                    image: {
                        bytesBase64Encoded: imgB64,
                        mimeType: "image/jpeg"
                    },
                    referenceType: "asset"
                }));
            } else if (firstFrame || lastFrame) {
                // Mode: First & Last Frame (interpolation)
                if (firstFrame) {
                    logger.info("Using first frame for video generation");
                    instancePayload.image = {
                        bytesBase64Encoded: firstFrame,
                        mimeType: "image/jpeg"
                    };
                }
                if (lastFrame) {
                    logger.info("Using last frame for video generation");
                    instancePayload.lastFrame = {
                        bytesBase64Encoded: lastFrame,
                        mimeType: "image/jpeg"
                    };
                }
            } else if (referenceImage) {
                // Legacy: single reference image as first frame
                logger.info("Using legacy single reference image as first frame");
                instancePayload.image = {
                    bytesBase64Encoded: referenceImage,
                    mimeType: "image/jpeg"
                };
            }

            const response = await axios.post(`${apiUrl}?key=${apiKey}`, {
                instances: [instancePayload],
                parameters: {
                    aspectRatio: videoAspectRatio,
                    resolution: videoResolution
                }
            });

            let operation = response.data;
            if (!operation || !operation.name) {
                throw new Error("Veo Engine failed to start operation. Possible quota or key issue.");
            }

            logger.info(`Veo Operation started: ${operation.name}`);

            // Robust Polling Loop (Max 8 Minutes total)
            const startTime = Date.now();
            const POLL_TIMEOUT = 480000; // 8 minutes in ms
            const opUrl = `https://generativelanguage.googleapis.com/v1beta/${operation.name}?key=${apiKey}`;

            while (!operation.done && (Date.now() - startTime < POLL_TIMEOUT)) {
                logger.info(`Waiting for video... (${Math.floor((Date.now() - startTime)/1000)}s elapsed)`);
                await new Promise(r => setTimeout(r, 10000));
                
                try {
                    const pollRes = await axios.get(opUrl);
                    operation = pollRes.data;
                } catch (e: any) {
                    logger.warn(`Polling attempt failed (transient): ${e.message}. Continuing...`);
                }
            }

            if (!operation.done) {
                throw new Error("Video generation timed out on the provider side (8+ minutes). Operation is still running in background.");
            }

            if (operation.error) {
                throw new Error(`Veo Engine Error: ${operation.error.message}`);
            }

            const generateVideoResponse = operation.response?.generateVideoResponse || operation.response;
            if (!generateVideoResponse?.generatedSamples?.[0]) {
                logger.error("Veo operation completed but no videos found in response:", operation.response);
                throw new Error("No video file generated in the response.");
            }

            const generatedVideo = generateVideoResponse.generatedSamples[0];
            let videoUri = generatedVideo.video?.uri;
            
            if (!videoUri && generatedVideo.video?.name) {
                videoUri = `https://generativelanguage.googleapis.com/v1beta/${generatedVideo.video.name}:download?alt=media`;
            }

            if (!videoUri) {
                throw new Error("Video sample found but no URI present.");
            }

            // Download binary video data
            logger.info(`Video ready. Procuring binary data from ${videoUri}...`);
            const videoDownloadUrl = `${videoUri}&key=${apiKey}`;
            const videoRes = await axios.get(videoDownloadUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(videoRes.data);
            
            // ── Upload Video to Firebase Storage ───────────────
            const token = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
            filename = `projects/${projectId}/posts/${Date.now()}.mp4`;
            const bucket = admin.storage().bucket();
            const file = bucket.file(filename);

            await file.save(buffer, {
                metadata: {
                    contentType: 'video/mp4',
                    metadata: {
                        generatedBy: request.auth.uid,
                        prompt: prompt,
                        projectId: projectId,
                        firebaseStorageDownloadTokens: token,
                        type: 'reel'
                    }
                }
            });

            downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;
            
            postData = {
                url: downloadUrl,
                storagePath: filename,
                prompt,
                platform: "Instagram",
                type: 'reel',
                aspectRatio: videoAspectRatio,
                status: 'generated',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: {
                    uid: request.auth.uid,
                    name: request.auth.token.name || "System"
                },
                projectReference: projectId,
                taskReference: taskId || null
            };

        } else {
            // ── IMAGE GENERATION (GEMINI 3 PRO IMAGE) ───────────────
            const inputParts: any[] = [{ text: prompt }];
            if (referenceImage) {
                inputParts.push({
                    inlineData: {
                        mimeType: "image/png",
                        data: referenceImage
                    }
                });
            }

            const imgRes: any = await ai.models.generateContent({
                model: "gemini-3-pro-image-preview",
                contents: [{ parts: inputParts }],
                config: {
                    responseModalities: ["IMAGE"],
                    imageConfig: {
                        aspectRatio: aspectRatio || "1:1",
                        imageSize: resolution || "2K"
                    }
                }
            } as any);

            let base64 = "";
            const candidate = imgRes.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            for (const part of parts) {
                if (part.inlineData?.data) {
                    base64 = part.inlineData.data;
                    break;
                }
            }

            if (!base64) {
                throw new Error("No image data returned from Gemini.");
            }

            const buffer = Buffer.from(base64, 'base64');
            const token = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
            filename = `projects/${projectId}/posts/${Date.now()}.png`;
            const bucket = admin.storage().bucket();
            const file = bucket.file(filename);

            await file.save(buffer, {
                metadata: {
                    contentType: 'image/png',
                    metadata: {
                        generatedBy: request.auth.uid,
                        prompt: prompt,
                        projectId: projectId,
                        firebaseStorageDownloadTokens: token
                    }
                }
            });

            downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;

            postData = {
                imageUrl: downloadUrl, // Keeping legacy key
                url: downloadUrl,     // Unified key
                storagePath: filename,
                prompt,
                platform,
                aspectRatio,
                resolution,
                type: 'image',
                status: 'generated',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: {
                    uid: request.auth.uid,
                    name: request.auth.token.name || "System"
                },
                projectReference: projectId,
                taskReference: taskId || null
            };
        }

        // ── Store Metadata in Firestore ───────────────
        const postRef = await admin.firestore()
            .collection('projects')
            .doc(projectId)
            .collection('posts')
            .add(postData);

        logger.info(`Successfully generated and saved post: ${postRef.id}`);

        return {
            id: postRef.id,
            url: downloadUrl,
            metadata: postData
        };

    } catch (error: any) {
        logger.error("generateSocialPost failed:", error);
        throw new HttpsError("internal", `Generation failed: ${error.message}`);
    }
});

/**
 * Seed Admin User (Utility)
 * Triggered manually to create a master admin account.
 */
export const seedAdminUserManual = onRequest({ cors: true }, async (req, res) => {
    const admins = [
        { email: "rajeev@uxdlab.us", password: "Admin@123", name: "Rajeev (Admin)" },
        { email: "contactmeshreyansh@gmail.com", password: "Admin@123", name: "Shreyansh (Admin)" }
    ];

    const results = [];

    for (const adminData of admins) {
        try {
            let userRecord;
            try {
                userRecord = await admin.auth().getUserByEmail(adminData.email);
                logger.info(`Admin user ${adminData.email} already exists. Updating claims...`);
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    userRecord = await admin.auth().createUser({
                        email: adminData.email,
                        password: adminData.password,
                        displayName: adminData.name,
                    });
                    logger.info(`Created new admin user: ${userRecord.uid}`);
                } else {
                    throw error;
                }
            }

            await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });
            
            const employeeRef = admin.firestore().collection('employees').doc(userRecord.uid);
            const employeeDoc = await employeeRef.get();
            
            if (!employeeDoc.exists) {
                await employeeRef.set({
                    name: adminData.name,
                    email: adminData.email,
                    role: "Super Admin",
                    department: "Management",
                    status: "Active",
                    authUid: userRecord.uid,
                    createdAt: new Date()
                });
            }

            results.push({ email: adminData.email, success: true, uid: userRecord.uid });
        } catch (error: any) {
            logger.error(`Error seeding admin user ${adminData.email}:`, error);
            results.push({ email: adminData.email, success: false, error: error.message });
        }
    }

    res.send({ results });
});

import { MongoClient } from "mongodb";

// Helper to recursively convert Firestore Timestamps to JS Dates
function convertTimestampsToDates(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj && typeof obj.toDate === 'function') {
        return obj.toDate();
    }
    if (Array.isArray(obj)) {
        return obj.map(item => convertTimestampsToDates(item));
    }
    if (typeof obj === 'object') {
        const copy: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                copy[key] = convertTimestampsToDates(obj[key]);
            }
        }
        return copy;
    }
    return obj;
}

// Main MongoDB backup / sync implementation
async function performMongoDBSync() {
    const db = admin.firestore();
    const settingsDoc = await db.collection('settings').doc('mongodb').get();
    if (!settingsDoc.exists) {
        throw new Error("MongoDB Connection URI not configured. Please save it in settings first.");
    }
    const data = settingsDoc.data();
    const uri = data?.uri || data?.connectionString;
    if (!uri) {
        throw new Error("MongoDB Connection URI is empty. Please enter a valid connection string.");
    }

    const client = new MongoClient(uri);
    await client.connect();
    try {
        const mongoDb = client.db('uxdcrm_backup');
        
        const collectionsToSync = [
            'users',
            'employees',
            'clients',
            'projects',
            'blogs',
            'assets',
            'assetIssues',
            'settings',
            'leads',
            'invoices',
            'apps',
            'emailSignatures',
            'emailTemplates',
            'lead_automation_logs',
            'appLinks',
            'backlinks'
        ];

        const syncResults: Record<string, number> = {};

        for (const colName of collectionsToSync) {
            const snapshot = await db.collection(colName).get();
            const docs: any[] = [];

            snapshot.forEach(doc => {
                const docData = doc.data();
                const cleanData = convertTimestampsToDates(docData);
                cleanData._id = doc.id;
                docs.push(cleanData);
            });

            const mongoCol = mongoDb.collection(colName);
            
            // Delete existing documents in the collection
            await mongoCol.deleteMany({});
            
            // Insert documents if we have any
            if (docs.length > 0) {
                await mongoCol.insertMany(docs);
            }
            
            syncResults[colName] = docs.length;
        }

        // Save backup log in Firestore
        await db.collection('mongodb_sync_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'success',
            syncedCollections: syncResults
        });

        return {
            success: true,
            syncedCollections: syncResults,
            timestamp: new Date().toISOString()
        };
    } catch (error: any) {
        // Save failure log in Firestore
        await db.collection('mongodb_sync_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            error: error.message
        });
        throw error;
    } finally {
        await client.close();
    }
}

/**
 * Cloud Function: Manual MongoDB Sync Trigger (Callable)
 */
export const manualMongoDBSync = onCall({ memory: "1GiB", timeoutSeconds: 300 }, async (request) => {
    // Only allow Admins to sync
    if (!request.auth || request.auth.token.role !== 'admin') {
        throw new HttpsError("permission-denied", "Only administrators can perform MongoDB backups.");
    }
    try {
        const result = await performMongoDBSync();
        return result;
    } catch (error: any) {
        logger.error("Manual MongoDB sync failed:", error);
        throw new HttpsError("internal", error.message || "Failed to perform MongoDB sync");
    }
});

/**
 * Cloud Function: Daily MongoDB Sync Scheduler (Runs at 00:00 every day)
 */
export const dailyMongoDBSync = onSchedule({
    schedule: "0 0 * * *",
    timeZone: "Asia/Kolkata",
    memory: "1GiB",
    timeoutSeconds: 300
}, async (event) => {
    logger.info("Executing scheduled Daily MongoDB Sync...");
    try {
        const result = await performMongoDBSync();
        logger.info("Daily MongoDB sync completed successfully:", result);
    } catch (error: any) {
        logger.error("Daily MongoDB sync failed:", error);
    }
});








