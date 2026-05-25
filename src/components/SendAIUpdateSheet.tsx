import { useState, useRef, useEffect } from "react"
import { format } from "date-fns"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "src/components/ui/sheet"
import { Button } from "src/components/ui/button"
import { Checkbox } from "src/components/ui/checkbox"
import { Label } from "src/components/ui/label"
import { Input } from "src/components/ui/input"
import {
    Send,
    Loader2,
    Upload,
    Sparkles,
    Bot
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "src/lib/utils"
import { generateAIContent } from "src/lib/gemini"
import { projectService } from "src/firebase/projectService"
import { type Project } from "src/store/slices/projectsSlice"
import { generateEmailTemplate } from "src/utils/emailTemplate"
import { storage } from "src/firebase/config"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { useAuth } from "src/contexts/AuthContext"
import { useEmployees } from "src/hooks/useEmployees"
import { useClients } from "src/hooks/useClients"

// React Quill
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface SendAIUpdateSheetProps {
    project: Project | null
    open: boolean
    onOpenChange: (open: boolean) => void
    initialMailType?: 'task' | 'custom' | 'query'
}

export function SendAIUpdateSheet({ project, open, onOpenChange, initialMailType = 'task' }: SendAIUpdateSheetProps) {
    const { user } = useAuth()
    const { employees } = useEmployees()
    const { clients } = useClients()

    const currentEmployee = employees.find(e => e.authUid === user?.uid || e.email === user?.email)

    const [step, setStep] = useState<'generate' | 'review'>('generate')
    const [mailType, setMailType] = useState<'task' | 'custom' | 'query'>(initialMailType)
    const [selectedTasks, setSelectedTasks] = useState<string[]>([])
    const [generatedSummary, setGeneratedSummary] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [emailSubject, setEmailSubject] = useState('')
    const [sending, setSending] = useState(false)
    const [aiTone, setAiTone] = useState<'crisp' | 'detailed'>('detailed')
    const [_sendWhatsApp, _setSendWhatsApp] = useState(false)

    // CC/BCC states
    const [ccEmail, setCcEmail] = useState('')
    const [bccEmail, setBccEmail] = useState('')
    const [recipientEmail, setRecipientEmail] = useState("")
    const [_savedCcEmails, _setSavedCcEmails] = useState<string[]>([])
    const [_savedBccEmails, _setSavedBccEmails] = useState<string[]>([])
    const [_ccDropdownOpen, _setCcDropdownOpen] = useState(false)
    const [_bccDropdownOpen, _setBccDropdownOpen] = useState(false)

    // Attachments states
    const [selectedAttachments, setSelectedAttachments] = useState<any[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const quillModules = {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
        ],
    };

    const quillFormats = [
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet'
    ];

    // Helper to get project tasks based on status
    const getProjectTasks = (p: Project, status: string = 'Completed') => {
        const milestones = (p.milestones || [])
            .filter((m: any) => {
                const mStatus = (m.status || '').trim().toLowerCase();
                const targetStatus = status.trim().toLowerCase();
                if (targetStatus === 'pending') return mStatus === 'pending' || !mStatus;
                if (targetStatus === 'completed') return mStatus === 'completed';
                return mStatus === targetStatus;
            })
            .flatMap((m: any) => {
                const subtasks = m.subtasks || [];
                const taskLabel = m.task || m.title || m.name || 'Unnamed Task';
                if (subtasks.length > 0) {
                    return [taskLabel, ...subtasks.map((st: any) => `  - ${st.title} (${st.completed ? 'Done' : 'Pending'})`)];
                }
                return [taskLabel];
            });
        return milestones;
    }


    useEffect(() => {
        if (open && project) {
            setStep('generate')
            setMailType(initialMailType)
            
            const completed = getProjectTasks(project, 'Completed')
            const inProgress = getProjectTasks(project, 'In Progress')
            const pending = getProjectTasks(project, 'Pending')
            
            // Default selection
            const defaultSelected = project.category === 'Digital Marketing' 
                ? [...completed, ...inProgress] 
                : [...completed, ...inProgress, ...pending];
            setSelectedTasks(defaultSelected)
            
            const dateStr = format(new Date(), 'do MMMM')
            setEmailSubject(`${initialMailType === 'task' ? 'Daily Update' : (initialMailType === 'custom' ? 'Project Update' : 'Project Query')}: ${project.name} - ${dateStr}`)
            
            setGeneratedSummary('')
            setSelectedAttachments([])
            
            // Find client email
            const client = clients.find(c => c.company === project?.client || c.name === project?.client)
            setRecipientEmail(client?.email || "")
            // _setSendWhatsApp(false)
        }
    }, [open, project, initialMailType, clients])

    useEffect(() => {
        if (project && open) {
            const dateStr = format(new Date(), 'do MMMM')
            setEmailSubject(`${mailType === 'task' ? 'Daily Update' : (mailType === 'custom' ? 'Project Update' : 'Project Query')}: ${project.name} - ${dateStr}`)
        }
    }, [mailType, project, open])

    const saveCcEmail = (email: string) => {
        const emails = JSON.parse(localStorage.getItem('savedCcEmails') || '[]')
        if (email && !emails.includes(email)) {
            const newEmails = [email, ...emails].slice(0, 10)
            localStorage.setItem('savedCcEmails', JSON.stringify(newEmails))
            // _setSavedCcEmails(newEmails)
        }
    }

    const saveBccEmail = (email: string) => {
        const emails = JSON.parse(localStorage.getItem('savedBccEmails') || '[]')
        if (email && !emails.includes(email)) {
            const newEmails = [email, ...emails].slice(0, 10)
            localStorage.setItem('savedBccEmails', JSON.stringify(newEmails))
            // _setSavedBccEmails(newEmails)
        }
    }

    const toggleTaskSelection = (task: string) => {
        setSelectedTasks(prev =>
            prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]
        )
    }

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !project) return
        setIsUploading(true)
        try {
            const uploaded: any[] = []
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const fileRef = ref(storage, `email-attachments/${project.id}/${Date.now()}_${file.name}`)
                const snapshot = await uploadBytes(fileRef, file)
                const url = await getDownloadURL(snapshot.ref)
                uploaded.push({ name: file.name, url, type: file.type || 'application/octet-stream' })
            }
            setSelectedAttachments(prev => [...prev, ...uploaded])
            toast.success("Files uploaded")
        } catch (error) {
            console.error(error)
            toast.error("Upload failed")
        } finally {
            setIsUploading(false)
        }
    }
    const handleGenerateSummary = async () => {
        if (!project) return
        setIsGenerating(true)
        try {
            const client = clients.find(c => c.company === project.client || c.name === project.client)
            const clientName = client?.name || "Client"

            const toneGuide = aiTone === 'crisp'
                ? `- Use HTML headings (<h3>) for status sections (COMPLETED, IN PROGRESS, PENDING).
                   - Use HTML bulleted lists (<ul> and <li>) for tasks under each heading.
                   - Use <strong> for task titles.
                   - Concise (2 sentences per task).`
                : `- Use HTML headings (<h3>) for status sections (COMPLETED, IN PROGRESS, PENDING).
                   - Use HTML bulleted lists (<ul> and <li>) for tasks under each heading.
                   - Use <strong> for task titles.
                   - Comprehensive and detailed (2-3 sentences per task).`

            let prompt = ""
            if (mailType === 'task') {
                const isDM = project.category === 'Digital Marketing'
                if (isDM) {
                    const marketingTasks = (project.milestones || []).filter(m => selectedTasks.includes(m.task) && m.postLink);
                    const tasksData = marketingTasks.map(m => `- ${m.task} (Link: ${m.postLink})`).join('\n')
                    prompt = `Write a professional update for ${project.name}. Digital Marketing focus. Client: ${clientName}. 
                    Content: ${tasksData}. 
                    ${toneGuide}. 
                    DO NOT include a subject line. DO NOT include a greeting or signature. ONLY generate the progress summary body content using HTML.`
                } else {
                    const getList = (status: string) => {
                        const tasks = getProjectTasks(project, status);
                        const selected = selectedTasks.filter(t => tasks.includes(t));
                        return selected.map(t => t.startsWith('  -') ? t : `- ${t}`).join('\n');
                    }
                    const completed = getList('Completed');
                    const inProgress = getList('In Progress');
                    const pending = getList('Pending');
                    
                    prompt = `Write a professional update for ${project.name}. Client: ${clientName}. 
                    Tasks: 
                    ${completed ? `COMPLETED:\n${completed}\n` : ''}
                    ${inProgress ? `IN PROGRESS:\n${inProgress}\n` : ''}
                    ${pending ? `PENDING:\n${pending}\n` : ''}
                    ${toneGuide}. 
                    Use <h3> headings for COMPLETED, IN PROGRESS, and PENDING.
                    DO NOT include a subject line. DO NOT include a greeting or signature. ONLY generate the progress summary body content using HTML.`
                }
            } else {
                prompt = `Rewrite this professionally using HTML: ${generatedSummary}. Project: ${project.name}. Client: ${clientName}. 
                ${toneGuide}. 
                DO NOT include a subject line. DO NOT include a greeting or signature. ONLY generate the progress summary body content using HTML.`
            }

            const summary = await generateAIContent(prompt)
            // Strip accidental subject line from AI output
            const cleanSummary = (summary || "").replace(/^(Subject|SUBJECT):\s*.*\n?/i, '').trim();
            setGeneratedSummary(cleanSummary || "Failed to generate.")
            
            const dateStr = new Date().toLocaleDateString()
            setEmailSubject(`${mailType === 'task' ? 'Daily Update' : 'Project Update'}: ${project.name} - ${dateStr}`)
            setStep('review')
        } catch (error) {
            console.error(error)
            toast.error("Generation failed")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSendMail = async () => {
        if (!project || !generatedSummary || !recipientEmail) return
        setSending(true)
        try {
            const client = clients.find(c => c.company === project.client || c.name === project.client)
            const clientName = client?.name?.split(' ')[0] || ''
            
            const dateStr = new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })

            const html = generateEmailTemplate({
                projectName: project.name,
                clientName: clientName,
                summary: generatedSummary,
                date: dateStr,
                credentials: project.credentials?.all || []
            })

            if (ccEmail) saveCcEmail(ccEmail)
            if (bccEmail) saveBccEmail(bccEmail)

            const sendOptions: any = {
                to: recipientEmail,
                subject: emailSubject,
                text: generatedSummary,
                html: html,
                cc: ccEmail || undefined,
                bcc: bccEmail || undefined,
                attachments: selectedAttachments.length > 0 ? selectedAttachments : undefined
            }

            // BDE Support
            if (currentEmployee?.department?.toLowerCase() === 'bde' && currentEmployee?.appPassword) {
                sendOptions.senderEmail = currentEmployee.bdEmail || currentEmployee.email
                sendOptions.senderAppPassword = currentEmployee.appPassword
                sendOptions.senderDisplayName = currentEmployee.name || user?.displayName || "UXDLab"
            }

            await projectService.sendEmail(sendOptions)
            
            // Update milestones to mark selected completed tasks as Delivered
            let updatedMilestones = project.milestones || []
            if (mailType === 'task') {
                updatedMilestones = updatedMilestones.map((m: any) => {
                    const taskLabel = m.task || m.title || m.name || 'Unnamed Task'
                    const isCompleted = (m.status || '').trim().toLowerCase() === 'completed'
                    // If it was selected and is completed, mark it delivered
                    if (isCompleted && selectedTasks.includes(taskLabel)) {
                        return { 
                            ...m, 
                            status: 'Delivered', 
                            deliveredAt: new Date().toISOString(),
                            deliveredDate: new Date().toLocaleDateString()
                        }
                    }
                    return m
                })
            }

            // Save history
            const historyItem = {
                date: new Date().toISOString(),
                subject: emailSubject,
                sender: currentEmployee?.name || user?.email || "UXDLab",
                content: generatedSummary,
                htmlContent: html,
                attachmentCount: selectedAttachments.length,
                attachments: selectedAttachments,
                cc: ccEmail || null,
                bcc: bccEmail || null
            }
            await projectService.saveEmailRecord(project.id!, historyItem)
            
            // Update project with delivered tasks and last email sent
            await projectService.updateProject(project.id!, {
                milestones: updatedMilestones,
                lastEmailSent: { date: new Date().toISOString(), subject: emailSubject, sender: historyItem.sender }
            })

            toast.success("Update sent successfully!")
            onOpenChange(false)
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Failed to send")
        } finally {
            setSending(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-[850px] flex flex-col h-full no-scrollbar">
                <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-2 text-xl">
                        <Bot className="h-6 w-6" />
                        Project Update
                    </SheetTitle>
                    <SheetDescription>
                        Generate and send progress updates for <strong>{project?.name}</strong>.
                    </SheetDescription>
                </SheetHeader>

                {project && (
                    <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                        <div className="space-y-6">
                            {step === 'generate' && (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['task', 'custom', 'query'].map((type: any) => (
                                            <div
                                                key={type}
                                                onClick={() => setMailType(type)}
                                                className={cn(
                                                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all text-center capitalize",
                                                    mailType === type ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"
                                                )}
                                            >
                                                <span className="text-xs font-semibold">{type} Mail</span>
                                            </div>
                                        ))}
                                    </div>

                                    {mailType === 'task' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {['crisp', 'detailed'].map((tone: any) => (
                                                <div
                                                    key={tone}
                                                    onClick={() => setAiTone(tone)}
                                                    className={cn(
                                                        "flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center capitalize",
                                                        aiTone === tone ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"
                                                    )}
                                                >
                                                    <span className="text-sm font-semibold">{tone}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {mailType === 'task' ? (
                                        <div className="space-y-4">
                                            {['Completed', 'In Progress', 'Pending'].map(status => {
                                                const tasks = getProjectTasks(project, status)
                                                if (tasks.length === 0) return null
                                                return (
                                                    <div key={status} className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase">{status}</Label>
                                                        <div className="border rounded-lg p-2 space-y-1 max-h-[150px] overflow-y-auto no-scrollbar">
                                                            {tasks.map((task, i) => (
                                                                <div key={i} className="flex items-start space-x-3 p-2 hover:bg-muted rounded-md transition-colors">
                                                                    <Checkbox
                                                                        checked={selectedTasks.includes(task)}
                                                                        onCheckedChange={() => toggleTaskSelection(task)}
                                                                    />
                                                                    <span className="text-sm cursor-pointer" onClick={() => toggleTaskSelection(task)}>{task}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold uppercase">Subject</Label>
                                                <Input 
                                                    value={emailSubject} 
                                                    onChange={(e) => setEmailSubject(e.target.value)}
                                                    className="h-10 border-slate-200"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase">CC</Label>
                                                    <Input 
                                                        value={ccEmail} 
                                                        onChange={(e) => setCcEmail(e.target.value)} 
                                                        placeholder="cc@example.com"
                                                        className="h-10 border-slate-200"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase">BCC</Label>
                                                    <Input 
                                                        value={bccEmail} 
                                                        onChange={(e) => setBccEmail(e.target.value)} 
                                                        placeholder="bcc@example.com"
                                                        className="h-10 border-slate-200"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-sm font-medium uppercase">Your Message</Label>
                                                <div className="pb-12">
                                                    <ReactQuill
                                                        theme="snow"
                                                        value={generatedSummary}
                                                        onChange={setGeneratedSummary}
                                                        modules={quillModules}
                                                        formats={quillFormats}
                                                        className="bg-white rounded-md h-[250px]"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3 pt-4">
                                        <Label className="text-sm font-medium uppercase">Attachments</Label>
                                        <div 
                                            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                                            {isUploading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : <Upload className="h-5 w-5 mx-auto text-muted-foreground" />}
                                            <p className="text-xs mt-1">Upload files to include</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {step === 'review' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Subject</Label>
                                        <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>CC</Label>
                                            <Input value={ccEmail} onChange={(e) => setCcEmail(e.target.value)} placeholder="cc@example.com" />
                                        </div>
                                        <div>
                                            <Label>BCC</Label>
                                            <Input value={bccEmail} onChange={(e) => setBccEmail(e.target.value)} placeholder="bcc@example.com" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Body</Label>
                                        <div className="pb-12">
                                            <ReactQuill
                                                theme="snow"
                                                value={generatedSummary}
                                                onChange={setGeneratedSummary}
                                                modules={quillModules}
                                                formats={quillFormats}
                                                className="bg-white rounded-md h-[350px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <SheetFooter className="mt-6 pt-6 border-t">
                    <div className="flex justify-between w-full">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <div className="flex gap-2">
                            {mailType === 'task' && step === 'generate' ? (
                                <Button onClick={handleGenerateSummary} disabled={isGenerating}>
                                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                    Generate Review
                                </Button>
                            ) : (
                                <Button onClick={handleSendMail} disabled={sending}>
                                    {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                    Send Update
                                </Button>
                            )}
                        </div>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
