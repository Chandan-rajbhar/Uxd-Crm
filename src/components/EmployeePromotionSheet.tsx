import { useState } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Sparkles,
    Loader2,
    Send,
    Calendar,
    Banknote,
    Check,
    ArrowLeft,
    FileEdit,
    ArrowUpRight,
} from "lucide-react"
import { toast } from "sonner"
import { candidateService } from "@/firebase/candidateService"
import { employeeService } from "@/firebase/employeeService"
import type { Employee } from "src/store/slices/employeesSlice"
import { generateAmendmentLetterPDF } from "@/utils/amendmentLetterGenerator"

interface EmployeePromotionSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    employee: Employee | null
    promotionType: "Internship (Paid)" | "Full Time" | null
}

type PromotionStep = "details" | "review" | "preview" | "sent"

export function EmployeePromotionSheet({ open, onOpenChange, employee, promotionType }: EmployeePromotionSheetProps) {
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0])
    const [newSalary, setNewSalary] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [offerMessage, setOfferMessage] = useState("")
    const [currentStep, setCurrentStep] = useState<PromotionStep>("details")
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

    const handleGenerateMessage = async () => {
        if (!employee) return
        if (!newSalary.trim()) {
            toast.error("Please enter the new salary/stipend")
            return
        }
        if (!effectiveDate) {
            toast.error("Please select an effective date")
            return
        }

        setIsGenerating(true)
        await new Promise(resolve => setTimeout(resolve, 800))

        const formattedDate = new Date(effectiveDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        })

        const typeLabel = promotionType === "Full Time" ? "Full-Time Employment" : "Paid Internship"
        
        const message = `Dear ${employee.name},

Congratulations! We are pleased to formally promote you to ${typeLabel} at UXDLAB, effective from ${formattedDate}.

This transition reflects your hard work, dedication, and the value you've brought to the team during your time with us. Below are the updated details:

📋 New Status: ${promotionType}
💰 Updated Compensation: Rs. ${newSalary} ${promotionType === "Full Time" ? "per annum" : "per month"}
📅 Effective Date: ${formattedDate}

We have generated an official Amendment Letter/Contract for you to review and sign digitally. Please access the link below to complete the process.

We are excited about your continued growth with us!

Best regards,
UXDLAB HR Team`

        setOfferMessage(message)
        setIsGenerating(false)
        setCurrentStep("review")
    }

    const getBase64FromUrl = async (url: string): Promise<string | null> => {
        return await candidateService.fetchAssetAsBase64(url);
    };

    const handlePreparePreview = async () => {
        if (!employee) return
        setIsGeneratingPdf(true)
        try {
            const config = await candidateService.getOfferConfig()
            const processedConfig = { ...config }

            // Fetch and convert assets to base64 for PDF generation
            if (config.logoBase64) {
                processedConfig.logoUrl = config.logoBase64;
            } else if (typeof config.logoUrl === 'string') {
                const logoBase64 = await getBase64FromUrl(config.logoUrl);
                if (logoBase64) processedConfig.logoUrl = logoBase64;
                else delete processedConfig.logoUrl;
            }

            if (config.signatureBase64) {
                processedConfig.signatureUrl = config.signatureBase64;
            } else if (typeof config.signatureUrl === 'string') {
                const sigBase64 = await getBase64FromUrl(config.signatureUrl);
                if (sigBase64) processedConfig.signatureUrl = sigBase64;
                else delete processedConfig.signatureUrl;
            }
            
            // Temporary candidate-like object for the generator
            const tempCandidate: any = {
                name: employee.name,
                position: employee.role,
                joiningDate: employee.joiningDate,
                offeredSalary: newSalary,
                email: employee.email
            }

            const doc = generateAmendmentLetterPDF(tempCandidate, processedConfig, effectiveDate, newSalary, promotionType as "Internship (Paid)" | "Full Time")
            const blob = doc.output('blob')
            const url = URL.createObjectURL(blob)
            
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
            setPdfUrl(url)
            setCurrentStep("preview")
        } catch (error) {
            console.error("Failed to generate preview:", error)
            toast.error("Failed to generate letter preview")
        } finally {
            setIsGeneratingPdf(false)
        }
    }

    const handleSendEmail = async () => {
        if (!employee || !employee.id || !offerMessage.trim()) return

        setIsSubmitting(true)
        try {
            const portalCode = Math.floor(100000 + Math.random() * 900000).toString()
            const signingUrl = `${window.location.origin}/employee-signing/${employee.id}`

            // 1. Generate & Upload PDF
            const config = await candidateService.getOfferConfig()
            const processedConfig = { ...config }

            // Fetch assets for final PDF
            if (config.logoBase64) {
                processedConfig.logoUrl = config.logoBase64;
            } else if (typeof config.logoUrl === 'string') {
                const logoBase64 = await getBase64FromUrl(config.logoUrl);
                if (logoBase64) processedConfig.logoUrl = logoBase64;
                else delete processedConfig.logoUrl;
            }

            if (config.signatureBase64) {
                processedConfig.signatureUrl = config.signatureBase64;
            } else if (typeof config.signatureUrl === 'string') {
                const sigBase64 = await getBase64FromUrl(config.signatureUrl);
                if (sigBase64) processedConfig.signatureUrl = sigBase64;
                else delete processedConfig.signatureUrl;
            }
            
            // Temporary candidate-like object for the generator
            const tempCandidate: any = {
                name: employee.name,
                position: employee.role,
                joiningDate: employee.joiningDate,
                offeredSalary: newSalary,
                email: employee.email
            }

            const doc = generateAmendmentLetterPDF(tempCandidate, processedConfig, effectiveDate, newSalary, promotionType as "Internship (Paid)" | "Full Time")
            const pdfBlob = doc.output('blob')
            const pdfFile = new File([pdfBlob], `Amendment_Letter_${employee.name.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' })
            const pdfUrl = await candidateService.uploadOfferAsset(pdfFile, 'amendment_letter')

            // 2. Update Employee record
            await employeeService.updateEmployee(employee.id, {
                amendmentLetterUrl: pdfUrl,
                amendmentLetterSentAt: new Date().toISOString(),
                amendmentPortalCode: portalCode,
                pendingEmploymentType: promotionType,
                amendmentEffectiveDate: effectiveDate,
                amendmentNewSalary: newSalary,
            })

            // 3. Send Email
            await candidateService.sendCandidateEmail({
                to: employee.email,
                subject: `Congratulations on your Promotion! - Amendment Letter`,
                text: `${offerMessage}\n\nAccess Code: ${portalCode}\nSigning Link: ${signingUrl}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
                        <h2 style="color: #E83C91;">Congratulations, ${employee.name}! 🚀</h2>
                        <div style="font-size: 15px; line-height: 1.6; color: #334155;">
                            ${offerMessage.split('\n').map(l => `<p>${l}</p>`).join('')}
                        </div>
                        <div style="margin-top: 32px; padding: 24px; background: #f8fafc; border-radius: 12px; text-align: center;">
                            <p style="margin-bottom: 16px; font-weight: bold;">Digital Signing Portal</p>
                            <a href="${signingUrl}" style="background: #E83C91; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Review & Sign Document</a>
                            <p style="margin-top: 16px; font-size: 12px; color: #64748b;">Security Access Code: <span style="font-family: monospace; font-weight: bold; font-size: 16px; color: #1e293b;">${portalCode}</span></p>
                        </div>
                    </div>
                `
            })

            setCurrentStep("sent")
            toast.success("Promotion details sent successfully!")
        } catch (error) {
            console.error("Error sending promotion details:", error)
            toast.error("Failed to send details")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setNewSalary("")
        setEffectiveDate(new Date().toISOString().split('T')[0])
        setOfferMessage("")
        setCurrentStep("details")
        onOpenChange(false)
    }

    if (!employee) return null

    return (
        <Sheet open={open} onOpenChange={handleClose}>
            <SheetContent className="sm:max-w-[600px] overflow-y-auto">
                <SheetHeader>
                    <div className="h-12 w-12 bg-pink-50 rounded-full flex items-center justify-center mb-4">
                        <ArrowUpRight className="h-6 w-6 text-pink-600" />
                    </div>
                    <SheetTitle>Promote {employee.name}</SheetTitle>
                    <SheetDescription>
                        Transition to {promotionType} and send the Amendment Letter / Contract.
                    </SheetDescription>
                </SheetHeader>

                {currentStep === "details" && (
                    <div className="space-y-6 py-6 transition-all animate-in slide-in-from-right-4">
                        <div className="grid gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Current Role</Label>
                                <p className="font-semibold">{employee.role}</p>
                            </div>
                            <div>
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Current Type</Label>
                                <p className="font-semibold">{employee.employmentType}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2">
                                    <Banknote className="h-4 w-4 text-slate-400" />
                                    {promotionType === "Full Time" ? "New Annual Salary (CTC)" : "Monthly Stipend"}
                                </Label>
                                <Input
                                    type="text"
                                    placeholder={promotionType === "Full Time" ? "e.g. 5,00,000" : "e.g. 15,000"}
                                    value={newSalary}
                                    onChange={(e) => setNewSalary(e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    Effective Date
                                </Label>
                                <Input
                                    type="date"
                                    value={effectiveDate}
                                    onChange={(e) => setEffectiveDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full bg-pink-600 hover:bg-pink-700"
                            onClick={handleGenerateMessage}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                            Generate Amendment Message
                        </Button>
                    </div>
                )}

                {currentStep === "review" && (
                    <div className="space-y-6 py-6 animate-in slide-in-from-right-4">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 font-bold">
                                <FileEdit className="h-4 w-4 text-slate-400" />
                                Review Notification Message
                            </Label>
                            <Button variant="ghost" size="sm" onClick={() => setCurrentStep("details")}>
                                <ArrowLeft className="h-3 w-3 mr-1" /> Edit Details
                            </Button>
                        </div>
                        <Textarea
                            value={offerMessage}
                            onChange={(e) => setOfferMessage(e.target.value)}
                            rows={15}
                            className="bg-slate-50 text-sm leading-relaxed"
                        />
                        <p className="text-[11px] text-slate-400">
                            An official Amendment Letter (PDF) will be attached to this email and available via a secure signing portal.
                        </p>
                    </div>
                )}

                {currentStep === "preview" && (
                    <div className="space-y-4 py-4 h-[60vh] flex flex-col">
                         <div className="flex items-center justify-between shrink-0">
                            <Label className="flex items-center gap-2 font-bold">
                                <FileEdit className="h-4 w-4 text-slate-400" />
                                Review Amendment Letter
                            </Label>
                            <Button variant="ghost" size="sm" onClick={() => setCurrentStep("review")}>
                                <ArrowLeft className="h-3 w-3 mr-1" /> Back to Message
                            </Button>
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                            {pdfUrl ? (
                                <iframe 
                                    src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                                    className="w-full h-full border-none" 
                                    title="Amendment Letter Preview"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {currentStep === "sent" && (
                    <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95">
                        <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                            <Check className="h-10 w-10 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold">Promotion Sent!</h3>
                        <p className="text-sm text-slate-500 max-w-xs mt-2">
                            The notification and signing link have been sent to {employee.email}.
                        </p>
                    </div>
                )}

                <SheetFooter className="mt-6">
                    {currentStep === "review" && (
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
                            <Button
                                className="flex-[1.5] bg-pink-600 hover:bg-pink-700"
                                onClick={handlePreparePreview}
                                disabled={isGeneratingPdf}
                            >
                                {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                                Preview Amendment Letter
                            </Button>
                        </div>
                    )}
                    {currentStep === "preview" && (
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" className="flex-1" onClick={() => setCurrentStep("review")}>Back</Button>
                            <Button
                                className="flex-[1.5] bg-emerald-600 hover:bg-emerald-700"
                                onClick={handleSendEmail}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                Confirm & Send Letter
                            </Button>
                        </div>
                    )}
                    {currentStep === "sent" && (
                        <Button className="w-full" onClick={handleClose}>Close</Button>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
