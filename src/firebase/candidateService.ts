import { db, functions, storage } from "./config"
import {
    doc,
    getDoc,
    setDoc
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, getBytes } from "firebase/storage"
import { httpsCallable } from "firebase/functions"

// Structurally compatible type for document generation, reused by the employee module
export interface Candidate {
    id?: string
    name: string
    email: string
    phone: string
    position: string
    experience: string
    address: string
    expectedSalary: string
    noticePeriod: string
    source: string
    status: string
    interviewDate?: string | null
    createdAt?: any
    offeredSalary?: string | null
    jobType?: string | null
    internshipDuration?: string | null
    joiningDate?: string | null
    unpaidMonths?: string | null
    paidMonths?: string | null
    monthlyStipend?: string | null
    internshipCompletionUrl?: string | null
}

export interface OfferConfig {
    hrName: string
    hrDesignation: string
    companyName: string
    logoUrl?: string | null
    signatureUrl?: string | null
    logoBase64?: string | null
    signatureBase64?: string | null
    signatureType?: 'image' | 'text'
    signatureText?: string
    signatureFont?: string
    // Template fields
    offerLetterIntro?: string
    offerLetterTerms?: string[]
    internshipLetterBody?: string
    internshipCompletionBody?: string
    amendmentLetterBody?: string
    relievingLetterBody?: string
}

export const candidateService = {
    async sendCandidateEmail(data: { 
        to: string, 
        subject: string, 
        text: string, 
        html: string,
        attachments?: { name: string, url: string, type: string }[] 
    }) {
        try {
            const sendEmailFn = httpsCallable(functions, 'sendEmail')
            const result = await sendEmailFn(data)
            return result.data
        } catch (error) {
            console.error("Error sending email via cloud function:", error)
            throw error
        }
    },

    async getOfferConfig(): Promise<OfferConfig> {
        const docRef = doc(db, "settings", "offer")
        const docSnap = await getDoc(docRef)
        
        const defaultConfig: OfferConfig = {
            hrName: "Neha Singh",
            hrDesignation: "Director HR",
            companyName: "UXDLAB Software Pvt. Ltd.",
            offerLetterIntro: "We are pleased to offer you the position of {position} at {companyName}, with your employment commencing on {joiningDate}. Your selection is based on your skills, experience, and alignment with our company’s objectives.",
            offerLetterTerms: [
                "Your employment is subject to signing a six-month employment contract.",
                "You will be placed on a six-month probationary period starting from your joining date.",
                "Your performance and conduct will be evaluated at the end of the probation period.",
                "Upon satisfactory performance, your employment will be confirmed in writing.",
                "The company reserves the right to extend the probation period by up to six additional months.",
                "If performance does not meet expectations, the company may terminate without prior notice."
            ],
            internshipCompletionBody: "This is to certify that {name}, has successfully completed their internship as a {position} at {companyName} from {joiningDate} to {internshipEndDate}.\n\nDuring this period, he worked closely with our development team and contributed to various tasks and projects.\n\n{name} showed strong technical skills, creativity, and a willingness to learn. He was proactive in taking up challenges and delivering quality work within deadlines.\n\nWe appreciate his contributions during the internship and wish him great success in all future endeavors.",
            amendmentLetterBody: "We are pleased to inform you that, effective from {effectiveDate}, your internship role with {companyName} will transition from an unpaid position to a paid internship of {salary} per month.\n\nWith this appraisal, you will be assigned new roles and responsibilities, which you need to adhere to. This achievement has been received by you over a period of time and with hard work and dedication towards work. We hope you continue to work with the same dedication for your new position in the future.\n\nIf you have any questions, please feel free to reach out at any time. We wish you once again a hearty congratulations on your progress and all the very best for the future.",
            relievingLetterBody: "This is to certify that {name} was employed as a {position} at {companyName} from {joiningDate} to {relievingDate}.\n\nDuring his tenure, he demonstrated sincere dedication and excellent performance in his role. His strong interpersonal skills, professionalism, and willingness to assist his team were highly appreciated by his managers.\n\nWe would like to draw attention to the clauses pertaining to separation mentioned in your appointment letter as terms and conditions of employment.\n\n1. CONFIDENTIALITY, NON-DISCLOSURE & INTELLECTUAL PROPERTY RIGHTS\nYou shall at all times, whether during or after the separation of the {companyName} employment, act with utmost fidelity and shall not disclose or divulge any such information to third parties or make use of such information for your own benefit or otherwise howsoever, sharing of proprietary information about the company or its clients is also prohibited.\n\n2. NON-POACHING\nYou are strictly prohibited from poaching any current employees of {companyName} through any explicit or implicit act to the new employer, allied agencies, partners, competitors & competition (including but not limited to). Any such act of encouraging separation of {companyName} employees will be regarded as grossly unprofessional and highly detrimental to the Company interest and Company will be forced to initiate legal action against you.\n\n3. SOCIAL MEDIA USAGE\nYou are prohibited from posting any defamatory comments about company, employees, clients and associates online. Usage of anonymous accounts to share proprietary information, post disparaging comments online, print or in public is also prohibited. We expect compliance to the non-competition, non-solicitation, non-disclosure, non-poach and non-disparagements clauses.\n\nYou are requested to abide by all the above-mentioned clauses and provide your acceptance by signing this letter.\nWe wish you success in your future endeavors.\nWe sincerely appreciate his contributions and wish him success in his future endeavors."
        }

        if (docSnap.exists()) {
            return { ...defaultConfig, ...docSnap.data() } as OfferConfig
        }
        
        return defaultConfig
    },

    async updateOfferConfig(config: Partial<OfferConfig>) {
        const docRef = doc(db, "settings", "offer")
        await setDoc(docRef, config, { merge: true })
    },

    async uploadOfferAsset(file: File, type: string) {
        const timestamp = Date.now()
        const fileName = `${type}_${timestamp}_${file.name}`
        const storageRef = ref(storage, `offer_assets/${fileName}`)

        await uploadBytes(storageRef, file)
        return await getDownloadURL(storageRef)
    },

    fetchAssetAsBase64: async (url: string): Promise<string | null> => {
        if (!url) return null;
        
        const fetchWithTimeout = async () => {
            try {
                const storageRef = ref(storage, url);
                const buffer = await getBytes(storageRef);
                return new Promise<string | null>((resolve) => {
                    const blob = new Blob([buffer]);
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(null);
                });
            } catch (sdkError) {
                console.warn("SDK Asset fetch failed, attempting canvas fallback:", sdkError);
                return new Promise<string | null>((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        try {
                            const canvas = document.createElement("canvas");
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext("2d");
                            if (ctx) {
                                ctx.drawImage(img, 0, 0);
                                resolve(canvas.toDataURL("image/png"));
                            } else resolve(null);
                        } catch (err) { resolve(null); }
                    };
                    img.onerror = () => resolve(null);
                    img.src = url;
                });
            }
        };

        return Promise.race([
            fetchWithTimeout(),
            new Promise<null>((resolve) => setTimeout(() => {
                console.warn("Asset fetch timed out for URL:", url);
                resolve(null);
            }, 5000))
        ]);
    }
}
