import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Send, FilePlus, Calendar, Banknote } from "lucide-react"
import { useState, useEffect } from "react"
import { candidateService, type Candidate } from "@/firebase/candidateService"
import { generateAmendmentLetterPDF } from "@/utils/amendmentLetterGenerator"
import { toast } from "sonner"

interface AmendmentLetterReviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    candidate: Candidate | null
    onSend: (effectiveDate: string, newSalary: string) => Promise<void>
    isSending: boolean
}

export function AmendmentLetterReviewDialog({ open, onOpenChange, candidate, onSend, isSending }: AmendmentLetterReviewDialogProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [newSalary, setNewSalary] = useState<string>("")
    const [isGenerating, setIsGenerating] = useState(false)

    const getBase64FromUrl = async (url: string): Promise<string | null> => {
        return await candidateService.fetchAssetAsBase64(url);
    };

    const loadAndGenerate = async () => {
        if (!candidate) return
        setIsGenerating(true)
        try {
            const config = await candidateService.getOfferConfig()
            const processedConfig = { ...config }
            
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

            const doc = generateAmendmentLetterPDF(candidate, processedConfig, effectiveDate, newSalary, "Internship")
            const blob = doc.output('blob')
            const url = URL.createObjectURL(blob)
            
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
            setPdfUrl(url)
        } catch (error) {
            console.error("Failed to generate amendment letter preview:", error)
            toast.error("Failed to generate preview")
        } finally {
            setIsGenerating(false)
        }
    }

    useEffect(() => {
        if (open && candidate) {
            setNewSalary(candidate.offeredSalary || "")
            loadAndGenerate()
            
            return () => {
                if (pdfUrl) URL.revokeObjectURL(pdfUrl)
                setPdfUrl(null)
            }
        }
    }, [open, candidate])

    useEffect(() => {
        if (open && candidate && effectiveDate !== undefined) {
            loadAndGenerate()
        }
    }, [effectiveDate, newSalary])

    if (!candidate) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1000px] w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center">
                            <FilePlus className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900">
                                Amendment to Internship Offer
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                {candidate.name} • Transitioning Terms
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex bg-slate-50 p-2 px-4 rounded-xl border border-slate-100 gap-6">
                            <div className="flex flex-col gap-0.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Effective Date</Label>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                    <input 
                                        type="date" 
                                        value={effectiveDate}
                                        onChange={(e) => setEffectiveDate(e.target.value)}
                                        className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 p-0"
                                    />
                                </div>
                            </div>
                            <div className="w-px bg-slate-200 h-8 self-center" />
                            <div className="flex flex-col gap-0.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Salary/Stipend</Label>
                                <div className="flex items-center gap-2">
                                    <Banknote className="h-3.5 w-3.5 text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={newSalary}
                                        placeholder="Rs. 5,000 per month"
                                        onChange={(e) => setNewSalary(e.target.value)}
                                        className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 p-0 w-32"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 min-h-0 bg-slate-100 relative">
                    {isGenerating && !pdfUrl ? (
                         <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 z-10">
                            <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
                            <p className="text-sm font-medium text-slate-500">Generating amendment letter...</p>
                        </div>
                    ) : (
                        <iframe 
                            src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                            className="w-full h-full border-none" 
                            title="Amendment Letter Preview"
                        />
                    )}
                </div>

                <div className="px-6 py-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <p className="text-[11px] text-slate-400 italic max-w-sm">
                        Confirming these changes will generate an official amendment letter. The candidate will receive an email with the new terms.
                    </p>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)}
                            disabled={isSending}
                            className="h-12 px-6 rounded-xl text-slate-500 font-bold"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => onSend(effectiveDate, newSalary)} 
                            disabled={isSending || isGenerating || !pdfUrl || !newSalary}
                            className="h-12 px-10 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xl shadow-amber-200 transition-all gap-2"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Issuing Amendment...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Issue & Send Amendment
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
