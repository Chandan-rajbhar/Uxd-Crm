import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Send,
    Loader2,
    MessageCircle,
    Phone,
    Sparkles,
    ListChecks,
    CheckCircle2
} from "lucide-react"
import { toast } from "sonner"
import { whatsappService } from "src/firebase/whatsappService"
import { generateAIContent } from "@/lib/gemini"
import type { Project } from "src/store/slices/projectsSlice"

interface SendWhatsAppProjectUpdateProps {
    project: Project | null
    open: boolean
    onOpenChange: (open: boolean) => void
    clientPhone?: string 
    clientName?: string
    clientId?: string
}

export function SendWhatsAppProjectUpdate({ project, open, onOpenChange, clientPhone, clientName, clientId }: SendWhatsAppProjectUpdateProps) {
    const [message, setMessage] = useState("")
    const [sending, setSending] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [phoneNumber, setPhoneNumber] = useState("")
    const [selectedTasks, setSelectedTasks] = useState<string[]>([])
    const [step, setStep] = useState<'select' | 'review'>('select')

    useEffect(() => {
        if (open && project) {
            setPhoneNumber(clientPhone || "")
            setMessage("")
            setStep('select')

            // Pre-select completed tasks
            const tasks = getProjectTasks(project)
            setSelectedTasks(tasks)
        }
    }, [open, project, clientPhone])

    const getProjectTasks = (p: Project): string[] => {
        if (!p.milestones) return []
        return (p.milestones || [])
            .filter((m: any) => m.status === 'Completed' || m.status === 'In Progress')
            .map((m: any) => {
                const statusEmoji = m.status === 'Completed' ? '✅' : '🔄'
                return `${statusEmoji} ${m.task || m.name || m.title}`
            })
            .filter(Boolean)
    }

    const toggleTask = (task: string) => {
        setSelectedTasks(prev =>
            prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]
        )
    }

    const handleGenerateAI = async () => {
        if (!project) return
        setIsGenerating(true)
        try {
            const firstName = clientName?.split(' ')[0] || 'there'
            const tasksList = selectedTasks.join('\n')

            const prompt = `
                Write a short, professional WhatsApp message to update a client about their project progress.

                Client Name: ${firstName}
                Project Name: ${project.name}
                
                Tasks/Updates to include:
                ${tasksList}

                RULES:
                - Keep the message concise — suitable for WhatsApp (under 500 chars).
                - Start with "Hi ${firstName},"
                - Use emojis sparingly (1-2 max).
                - List the updates clearly with line breaks.
                - End with a brief closing like "Let us know if you have any feedback!"
                - Do NOT use markdown formatting (no bold **, no headers).
                - Write in a professional but friendly WhatsApp style.
                - Do NOT include any signature.
            `

            const generated = await generateAIContent(prompt)
            setMessage(generated || "")
            setStep('review')
            toast.success("AI message generated!")
        } catch (error) {
            console.error("Generation failed:", error)
            toast.error("Failed to generate message")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSend = async () => {
        if (!project || !phoneNumber.trim() || !message.trim()) {
            toast.error("Phone number and message are required")
            return
        }

        setSending(true)
        try {
            await whatsappService.sendProjectUpdate({
                to: phoneNumber,
                message: message,
                projectId: project.id,
                projectName: project.name,
                clientName: clientName,
                clientId: clientId
            })
            toast.success(`WhatsApp update sent for ${project.name}!`)
            setMessage("")
            onOpenChange(false)
        } catch (error: any) {
            console.error("Failed:", error)
            toast.error(error?.message || "Failed to send WhatsApp update")
        } finally {
            setSending(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-[600px] flex flex-col h-full p-0">
                {/* Header */}
                <div className="px-6 py-5 border-b">
                    <SheetHeader>
                        <SheetTitle className="text-slate-800 text-xl flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-[#25D366]" />
                            WhatsApp Project Update
                        </SheetTitle>
                        <SheetDescription className="text-slate-500">
                            Send a WhatsApp update for <strong className="text-slate-800">{project?.name}</strong>
                        </SheetDescription>
                    </SheetHeader>
                </div>

                {project && (
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <div className="space-y-5">
                            {/* Phone Number */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5" /> Client Phone Number
                                </Label>
                                {clientPhone ? (
                                    <div className="flex items-center gap-3 h-11 px-4 rounded-lg border border-[#25D366]/20 bg-[#25D366]/5">
                                        <div className="flex items-center gap-2 flex-1">
                                            <MessageCircle className="h-4 w-4 text-[#25D366]" />
                                            <span className="text-base font-semibold text-slate-800">{phoneNumber || clientPhone}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] font-bold border-[#25D366]/30 text-[#25D366] bg-white">
                                            {clientName || 'Client'}
                                        </Badge>
                                    </div>
                                ) : (
                                    <>
                                        <Input
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="+91 98765 43210"
                                            className="h-11 text-base font-medium border-slate-200 focus-visible:ring-[#25D366]"
                                        />
                                        <p className="text-[11px] text-muted-foreground">No phone on file — include country code (e.g., +91 for India)</p>
                                    </>
                                )}
                            </div>

                            {step === 'select' && (
                                <>
                                    {/* Task Selection */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <ListChecks className="h-3.5 w-3.5" /> Select Tasks to Include
                                        </Label>
                                        <div className="border rounded-xl p-1 space-y-0.5 max-h-[300px] overflow-y-auto no-scrollbar bg-slate-50/50">
                                            {getProjectTasks(project).length > 0 ? getProjectTasks(project).map((task: string, i: number) => (
                                                <div key={i} className="flex items-start space-x-3 p-3 hover:bg-white rounded-lg transition-colors cursor-pointer" onClick={() => toggleTask(task)}>
                                                    <Checkbox
                                                        id={`wa-task-${i}`}
                                                        checked={selectedTasks.includes(task)}
                                                        onCheckedChange={() => toggleTask(task)}
                                                    />
                                                    <label htmlFor={`wa-task-${i}`} className="text-sm font-medium leading-none cursor-pointer flex-1">{task}</label>
                                                </div>
                                            )) : (
                                                <p className="p-6 text-center text-sm text-muted-foreground">
                                                    No completed or in-progress tasks found for this project.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Custom Message Option */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            Or Write Custom Message
                                        </Label>
                                        <Textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Write your own update message..."
                                            className="min-h-[100px] resize-none text-sm border-slate-200 focus-visible:ring-[#25D366]"
                                        />
                                    </div>
                                </>
                            )}

                            {step === 'review' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Sparkles className="h-3.5 w-3.5" /> Review Message
                                        </Label>
                                        <Badge variant="outline" className="text-[10px] font-bold border-[#25D366]/30 text-[#25D366]">
                                            <Sparkles className="h-2.5 w-2.5 mr-1" /> AI Generated
                                        </Badge>
                                    </div>

                                    {/* WhatsApp-style preview */}
                                    <div className="bg-[#ECE5DD] rounded-2xl p-4">
                                        <div className="flex justify-end">
                                            <div className="bg-[#DCF8C6] rounded-xl rounded-tr-sm px-4 py-3 max-w-[90%] shadow-sm">
                                                <Textarea
                                                    value={message}
                                                    onChange={(e) => setMessage(e.target.value)}
                                                    className="min-h-[200px] resize-none text-sm bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                                                />
                                                <div className="flex items-center justify-end gap-1 mt-1">
                                                    <span className="text-[10px] text-slate-500">Now</span>
                                                    <CheckCircle2 className="h-3 w-3 text-[#53bdeb]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-start">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setStep('select')}
                                            className="text-xs font-bold text-muted-foreground"
                                        >
                                            ← Back to task selection
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <SheetFooter className="px-6 py-4 border-t bg-white">
                    <div className="flex items-center justify-between w-full gap-3">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold">
                            Cancel
                        </Button>

                        {step === 'select' ? (
                            <div className="flex items-center gap-2">
                                {message.trim() ? (
                                    // If custom message, skip AI and go directly to send
                                    <Button
                                        onClick={() => setStep('review')}
                                        className="font-bold bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 shadow-sm px-6"
                                    >
                                        <Send className="h-4 w-4" />
                                        Review & Send
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleGenerateAI}
                                        disabled={selectedTasks.length === 0 || isGenerating}
                                        className="font-bold bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 shadow-sm px-6"
                                    >
                                        {isGenerating ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="h-4 w-4" />
                                        )}
                                        Generate & Preview
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button
                                onClick={handleSend}
                                disabled={sending || !message.trim() || !phoneNumber.trim()}
                                className="font-bold bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 shadow-sm px-6"
                            >
                                {sending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Send WhatsApp
                            </Button>
                        )}
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
