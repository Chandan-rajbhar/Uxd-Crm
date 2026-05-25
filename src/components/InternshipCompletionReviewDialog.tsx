import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Send, FileCheck, Calendar } from "lucide-react"
import { useState, useEffect } from "react"
import { candidateService, type Candidate } from "@/firebase/candidateService"
import { generateInternshipCompletionPDF } from "@/utils/internshipCompletionGenerator"
import { toast } from "sonner"

interface InternshipCompletionReviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    candidate: Candidate | null
    onSend: (endDate: string) => Promise<void>
    isSending: boolean
}

export function InternshipCompletionReviewDialog({ open, onOpenChange, candidate, onSend, isSending }: InternshipCompletionReviewDialogProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [isGenerating, setIsGenerating] = useState(false)

    const getBase64FromUrl = async (url: string): Promise<string | null> => {
        return await candidateService.fetchAssetAsBase64(url);
    };

    const loadAndGenerate = async () => {
        if (!candidate) return
        setIsGenerating(true)
        try {
            const config = await candidateService.getOfferConfig()
            
            if (candidate.internshipCompletionUrl && !endDate) {
                 // If we already have one and no new date is picked, show the existing one
                 // But usually we want to let them regenerate with a specific date
            }

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

            const doc = generateInternshipCompletionPDF(candidate, processedConfig, endDate)
            const blob = doc.output('blob')
            const url = URL.createObjectURL(blob)
            
            // Clean up old local URL
            if (pdfUrl && !candidate?.internshipCompletionUrl) {
                URL.revokeObjectURL(pdfUrl)
            }
            
            setPdfUrl(url)
        } catch (error) {
            console.error("Failed to generate internship completion PDF preview:", error)
            toast.error("Failed to generate certificate preview")
        } finally {
            setIsGenerating(false)
        }
    }

    useEffect(() => {
        if (open && candidate) {
            loadAndGenerate()
            
            return () => {
                if (pdfUrl && !candidate.internshipCompletionUrl) {
                    URL.revokeObjectURL(pdfUrl)
                }
                setPdfUrl(null)
            }
        }
    }, [open, candidate])

    // Re-generate when end date changes
    useEffect(() => {
        if (open && candidate && endDate) {
            loadAndGenerate()
        }
    }, [endDate])

    if (!candidate) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1000px] w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <FileCheck className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                Internship Completion Certificate
                                {candidate.internshipCompletionUrl && (
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                        Previously Generated
                                    </span>
                                )}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                {candidate.name} • {candidate.position}
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 p-2 px-4 rounded-xl border border-slate-100">
                        <div className="flex flex-col gap-0.5">
                            <Label htmlFor="endDate" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Internship End Date</Label>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                <input 
                                    type="date" 
                                    id="endDate"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 p-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 min-h-0 bg-slate-100 relative overflow-hidden">
                    {isGenerating && !pdfUrl ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 z-10">
                            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                            <p className="text-sm font-medium text-slate-500 tracking-tight">Crafting certificate for {candidate.name}...</p>
                        </div>
                    ) : (
                        <iframe 
                            src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                            className="w-full h-full border-none" 
                            title="Internship Completion Preview"
                        />
                    )}
                    {isGenerating && pdfUrl && (
                         <div className="absolute top-4 right-4 bg-white/90 backdrop-blur shadow-sm rounded-lg px-3 py-1.5 flex items-center gap-2 border border-slate-100 animate-in fade-in slide-in-from-top-2">
                            <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Updating Preview...</span>
                         </div>
                    )}
                </div>

                <div className="px-6 py-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Certification Status</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                                <span className="text-xs font-bold text-slate-600">A4 High Fidelity PDF</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)}
                            disabled={isSending}
                            className="h-12 px-6 rounded-xl text-slate-500 font-bold hover:bg-slate-50"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => onSend(endDate)} 
                            disabled={isSending || isGenerating || !pdfUrl}
                            className="h-12 px-10 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-200 transition-all hover:-translate-y-0.5 active:translate-y-0 gap-2 min-w-[240px]"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing Document...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Issue & Send Certificate
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
