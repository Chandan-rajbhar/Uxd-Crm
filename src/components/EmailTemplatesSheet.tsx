import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "src/components/ui/sheet"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "src/components/ui/select"
import { Button } from "src/components/ui/button"
import { Input } from "src/components/ui/input"
import { Textarea } from "src/components/ui/textarea"
import { Plus, Trash2, Pencil, Save, FileText, Sparkles, Loader2, ShieldAlert, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useDispatch, useSelector } from "react-redux"
import { generateAIContent } from "src/lib/gemini"
import type { AppDispatch, RootState } from "src/store/store"
import { fetchTemplates, addTemplate, updateTemplate, deleteTemplate } from "src/store/slices/emailTemplatesSlice"
import type { EmailTemplate } from "src/store/slices/emailTemplatesSlice"
import { Label } from "src/components/ui/label"
import ReactQuill from "react-quill"
import "react-quill/dist/quill.snow.css"

interface EmailTemplatesSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentUser: any
}

export function EmailTemplatesSheet({ open, onOpenChange, currentUser }: EmailTemplatesSheetProps) {
    const dispatch = useDispatch<AppDispatch>()
    const { templates, loading } = useSelector((state: RootState) => state.emailTemplates)

    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [followUpOrder, setFollowUpOrder] = useState<number | undefined>(undefined)

    // AI view
    const [view, setView] = useState<'compose' | 'ai'>('compose')
    const [prompt, setPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)

    // Spam check
    const [isCheckingSpam, setIsCheckingSpam] = useState(false)
    const [spamResults, setSpamResults] = useState<{ word: string, suggestions: string[] }[]>([])

    useEffect(() => {
        if (open && currentUser?.uid) {
            dispatch(fetchTemplates(currentUser.uid))
            resetForm()
        }
    }, [open, currentUser, dispatch])

    const resetForm = () => {
        setIsCreating(false)
        setEditingId(null)
        setName('')
        setSubject('')
        setBody('')
        setFollowUpOrder(undefined)
        setView('compose')
        setPrompt('')
        setSpamResults([])
        setIsCheckingSpam(false)
    }

    const handleGenerateDraft = async () => {
        if (!prompt.trim()) return
        setIsGenerating(true)
        try {
            const systemPrompt = `Write a professional email template.
User Request: ${prompt}

Rules:
- Professional, concise, persuasive. Format using semantic HTML tags like <p>, <strong>, <ul>, etc. instead of markdown.
- Do NOT wrap the entire response in a generic tag, just output the semantic elements.
- Use these variables where appropriate: {name} (for recipient name), {company} (for recipient company), {sender} (for your name).
- Output format:
SUBJECT: [subject line]
---
[email body formatted as HTML]`
            const response = await generateAIContent(systemPrompt)
            const subjectMatch = response.match(/SUBJECT:\s*(.+)/i)
            if (subjectMatch) {
                setSubject(subjectMatch[1].trim())
                const bodyStart = response.indexOf('---')
                setBody(bodyStart !== -1 ? response.substring(bodyStart + 3).trim() : response.replace(/SUBJECT:\s*.+\n?/, '').trim())
            } else {
                setBody(response)
            }
            toast.success("Template generated!")
            setView('compose') // Switch back to compose view
        } catch (error) {
            toast.error("Failed to generate draft")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleCheckSpam = async () => {
        if (!body.trim()) return
        setIsCheckingSpam(true)
        setSpamResults([])
        try {
            const systemPrompt = `Analyze the following email body and identify words or phrases that might be flagged by spam filters (like "FREE", "Urgent", "Guaranteed", "Winner", "Act Now", etc.). 
For each word/phrase found, provide 2-3 better, less 'spammy' alternatives.

Format your response AS A JSON ARRAY ONLY, like this:
[{"word": "FREE", "suggestions": ["Complimentary", "Inclusive", "Zero-cost"]}]

If no spammy words are found, return an empty array [].

Email Body:
${body}`

            const response = await generateAIContent(systemPrompt)
            const jsonMatch = response.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                const results = JSON.parse(jsonMatch[0])
                setSpamResults(results)
                if (results.length === 0) {
                    toast.success("No spam words detected!")
                } else {
                    toast.warning(`${results.length} potential spam words found`)
                }
            }
        } catch (error) {
            console.error("Spam check error:", error)
            toast.error("Failed to check for spam words")
        } finally {
            setIsCheckingSpam(false)
        }
    }

    const replaceSpamWord = (oldWord: string, newWord: string) => {
        const escapedWord = oldWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escapedWord, 'gi')
        setBody(prev => prev.replace(regex, newWord))
        setSpamResults(prev => prev.filter(r => r.word !== oldWord))
        toast.success(`Replaced "${oldWord}" with "${newWord}"`)
    }

    const handleSave = async () => {
        if (!name.trim() || !subject.trim() || !body.trim()) {
            toast.error("Please fill in all fields")
            return
        }

        if (!currentUser?.uid) {
            toast.error("User ID not found. Please try logging in again.")
            return
        }

        try {
            if (editingId) {
                const template = templates.find(t => t.id === editingId)
                if (template) {
                    await dispatch(updateTemplate({ ...template, name, subject, body, followUpOrder })).unwrap()
                    toast.success("Template updated")
                }
            } else {
                await dispatch(addTemplate({
                    name,
                    subject,
                    body,
                    userId: currentUser.uid,
                    followUpOrder
                })).unwrap()
                toast.success("Template created")
            }
            resetForm()
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error(error.message || "Failed to save template")
        }
    }

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (confirm("Are you sure you want to delete this template?")) {
            try {
                await dispatch(deleteTemplate(id)).unwrap()
                toast.success("Template deleted")
            } catch (error) {
                toast.error("Failed to delete template")
            }
        }
    }

    const handleEdit = (template: EmailTemplate) => {
        setIsCreating(true)
        setEditingId(template.id)
        setName(template.name)
        setSubject(template.subject || '')
        setBody(template.body || '')
        setFollowUpOrder(template.followUpOrder)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto no-scrollbar sm:max-w-[600px] w-full flex flex-col h-full bg-slate-50">
                <SheetHeader className="pb-4 border-b px-2">
                    <SheetTitle className="text-lg font-semibold flex items-center gap-2">
                        {view === 'ai' && (
                            <button onClick={() => setView('compose')} className="flex items-center gap-2 hover:text-primary transition-colors text-sm">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </button>
                        )}
                        {view !== 'ai' && (
                            <>
                                <FileText className="h-5 w-5 text-primary" />
                                Email Templates
                            </>
                        )}
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6">
                    {view === 'ai' ? (
                        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 space-y-6">
                            <div className="text-center space-y-2">
                                <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                                    <Sparkles className="h-7 w-7 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold">AI Template Generator</h3>
                                <p className="text-sm text-muted-foreground max-w-sm">
                                    Describe the kind of email template you want, and AI will generate it for you with variables included.
                                </p>
                            </div>
                            <div className="w-full max-w-md space-y-4">
                                <Textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g. A follow up email for a client who hasn't opened our proposal yet..."
                                    className="min-h-[140px] text-sm shadow-sm"
                                    autoFocus
                                />
                                <Button
                                    onClick={handleGenerateDraft}
                                    disabled={!prompt.trim() || isGenerating}
                                    className="w-full gap-2 h-11"
                                >
                                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    {isGenerating ? "Generating..." : "Generate Template"}
                                </Button>
                            </div>
                        </div>
                    ) : isCreating ? (
                        <div className="space-y-4 bg-white p-4 rounded-xl border shadow-sm">
                            <h3 className="font-semibold text-slate-800">{editingId ? 'Edit Template' : 'New Template'}</h3>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground font-semibold">Template Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Follow Up" className="h-9" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground font-semibold">Subject</Label>
                                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." className="h-9" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground font-semibold">Follow-up Order (Optional)</Label>
                                <Select value={(followUpOrder || 0).toString()} onValueChange={(val) => setFollowUpOrder(val === "0" ? undefined : parseInt(val))}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Standard template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Standard Template</SelectItem>
                                        <SelectItem value="1">1st Follow-up</SelectItem>
                                        <SelectItem value="2">2nd Follow-up</SelectItem>
                                        <SelectItem value="3">3rd Follow-up</SelectItem>
                                        <SelectItem value="4">4th Follow-up</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground font-semibold">Body</Label>
                                <div className="border rounded-md overflow-hidden [&_.ql-container]:text-sm [&_.ql-editor]:min-h-[200px] [&_.ql-toolbar]:border-x-0 [&_.ql-toolbar]:border-t-0 [&_.ql-toolbar]:bg-slate-50 [&_.ql-container]:border-none">
                                    <ReactQuill
                                        theme="snow"
                                        value={body}
                                        onChange={(content) => {
                                            setBody(content)
                                            if (spamResults.length > 0) setSpamResults([])
                                        }}
                                        placeholder="Use {name} for lead name, {company} for company, {sender} for your name..."
                                    />
                                </div>
                            </div>

                            {/* Spam Results Section */}
                            {spamResults.length > 0 && (
                                <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                        <span className="text-[11px] uppercase tracking-wider font-bold text-amber-800">Potential Spam Words</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pb-1">
                                        {spamResults.map((res, i) => (
                                            <div key={i} className="bg-white border border-amber-200 rounded-lg p-2 shadow-sm flex flex-col gap-1.5">
                                                <span className="text-[11px] font-bold text-slate-900 line-through decoration-amber-500/50 decoration-2">{res.word}</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {res.suggestions.map((sugg, j) => (
                                                        <button
                                                            key={j}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                replaceSpamWord(res.word, sugg)
                                                            }}
                                                            className="text-[10px] bg-amber-100 hover:bg-amber-600 hover:text-white text-amber-800 px-2 py-0.5 rounded-md transition-all font-medium"
                                                        >
                                                            {sugg}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                                <div className="flex border rounded-md overflow-hidden bg-slate-50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 rounded-none gap-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 px-3 border-r"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            setView('ai')
                                        }}
                                    >
                                        <Sparkles className="h-3.5 w-3.5" /> AI Templates
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleCheckSpam()
                                        }}
                                        disabled={isCheckingSpam || !body.trim()}
                                        className={`h-9 rounded-none gap-1.5 text-xs px-3 ${spamResults.length > 0 ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50'}`}
                                    >
                                        {isCheckingSpam ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                                        Spam Check
                                    </Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={resetForm} className="h-9">Cancel</Button>
                                    <Button onClick={handleSave} className="h-9 gap-2">
                                        <Save className="h-4 w-4" /> Save Template
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Manage your reusable email templates.</p>
                                <Button onClick={() => setIsCreating(true)} size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" /> New Template
                                </Button>
                            </div>

                            {loading && <div className="text-center text-sm text-muted-foreground py-8">Loading templates...</div>}

                            {!loading && templates.length === 0 && (
                                <div className="text-center text-sm text-muted-foreground py-12 border-2 border-dashed rounded-xl border-slate-200">
                                    No templates found. Create one to get started!
                                </div>
                            )}

                            {!loading && templates.length > 0 && (
                                <div className="grid gap-3">
                                    {templates.map(template => (
                                        <div key={template.id} className="bg-white p-4 rounded-xl border shadow-sm group relative">
                                            <div className="pr-16">
                                                <h4 className="font-semibold text-slate-800 truncate flex items-center gap-2">
                                                    {template.name}
                                                    {template.followUpOrder && (
                                                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                                                            {template.followUpOrder === 1 ? '1st' : template.followUpOrder === 2 ? '2nd' : template.followUpOrder === 3 ? '3rd' : '4th'} Followup
                                                        </span>
                                                    )}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1 truncate font-medium">Sub: {template.subject}</p>
                                                <p className="text-xs text-slate-500 mt-2 line-clamp-2">{template.body.replace(/<[^>]*>?/gm, '')}</p>
                                            </div>
                                            <div className="absolute right-4 top-4 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" onClick={() => handleEdit(template)} className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={(e) => handleDelete(e, template.id)} className="h-8 w-8 text-red-600 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
