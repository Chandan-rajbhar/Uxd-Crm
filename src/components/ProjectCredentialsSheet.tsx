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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Lock,
    Copy,
    ExternalLink,
    Save,
    Loader2,
    Plus,
    Trash2,
    Sparkles,
    Trash
} from "lucide-react"
import { projectService } from "src/firebase/projectService"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface CredentialItem {
    id: string
    name: string
    url: string
    email: string
    password?: string
}

interface ProjectCredentialsSheetProps {
    project: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProjectCredentialsSheet({ project, open, onOpenChange }: ProjectCredentialsSheetProps) {
    const [loading, setLoading] = useState(false)
    const [isAiOpen, setIsAiOpen] = useState(false)
    const [aiText, setAiText] = useState("")

    const [credentials, setCredentials] = useState<CredentialItem[]>([
        { id: '1', name: 'Primary Login', url: '', email: '', password: '' }
    ])

    useEffect(() => {
        if (project && open) {
            const raw = project.credentials || {}
            let items: CredentialItem[] = []

            const extract = (val: any, defaultName: string) => {
                if (Array.isArray(val)) return val
                if (typeof val === 'object' && val !== null && (val.url || val.email)) {
                    return [{ id: Math.random().toString(36).substr(2, 9), name: defaultName, ...val }]
                }
                return []
            }

            items = [
                ...extract(raw.all, 'Credential'),
                ...extract(raw.web || raw.website, 'Website'),
                ...extract(raw.dash || raw.dashboard, 'Dashboard'),
                ...extract(raw.app, 'App Store'),
                ...extract(raw.play || raw.play_console, 'Play Console')
            ]

            if (items.length === 0) {
                items = [{ id: '1', name: 'Primary Login', url: '', email: '', password: '' }]
            }

            setCredentials(items)
        }
    }, [project, open])

    const handleFieldChange = (id: string, field: string, value: string) => {
        setCredentials(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const addItem = () => {
        const newItem: CredentialItem = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'New Login',
            url: '',
            email: '',
            password: ''
        }
        setCredentials(prev => [...prev, newItem])
        toast.success("New entry added")
    }

    const removeItem = (id: string) => {
        if (credentials.length <= 1) {
            setCredentials([{ id: '1', name: 'Primary Login', url: '', email: '', password: '' }])
            return
        }
        setCredentials(prev => prev.filter(item => item.id !== id))
    }

    const clearAll = () => {
        if (window.confirm("Are you sure you want to clear all credentials?")) {
            setCredentials([{ id: '1', name: 'Primary Login', url: '', email: '', password: '' }])
        }
    }

    const handleCopy = (text: string) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        toast.success("Copied to clipboard")
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            await projectService.updateProject(project.id, {
                credentials: { all: credentials }
            })
            toast.success("Project credentials saved")
            onOpenChange(false)
        } catch (error) {
            console.error("Save failed:", error)
            toast.error("Failed to update credentials")
        } finally {
            setLoading(false)
        }
    }

    const handleAiParse = () => {
        if (!aiText.trim()) return

        const lines = aiText.split('\n').map(l => l.trim()).filter(l => l !== '')
        const foundItems: CredentialItem[] = []
        let globalUrl = ''

        // 1. Determine a global URL if only one exists in the text
        const urlMatches = aiText.match(/https?:\/\/[^\s]+/g)
        if (urlMatches && urlMatches.length === 1) {
            globalUrl = urlMatches[0]
        }

        // 2. Intelligent Block-Based Parsing
        let currentItem: Partial<CredentialItem> | null = null

        lines.forEach((line, index) => {
            const l = line.toLowerCase()
            const isEmail = line.includes('@') && line.includes('.')
            const isUrl = l.includes('http://') || l.includes('https://') || l.includes('.pages.dev') || l.includes('.vercel.app')
            const isPassword = l.includes('pass') || l.includes('pwd') || l.includes('password')

            if (isEmail) {
                // If we've already started an item and found another email, finish the previous one
                if (currentItem && currentItem.email) {
                    const item = currentItem as Partial<CredentialItem>
                    foundItems.push({
                        id: Math.random().toString(36).substr(2, 9),
                        name: item.name || 'New Login',
                        url: item.url || globalUrl,
                        email: item.email || '',
                        password: item.password || ''
                    })
                    currentItem = null
                }

                if (!currentItem) {
                    currentItem = { email: '' }
                    // Look back for a title/name (usually 1 or 2 lines back if email is at index 1 or 2 of the block)
                    if (index > 0) {
                        const prev = lines[index - 1]
                        if (!prev.includes('@') && !prev.includes('http') && prev.length < 50) {
                            currentItem.name = prev
                        } else if (index > 1) {
                            const prev2 = lines[index - 2]
                            if (!prev2.includes('@') && !prev2.includes('http') && prev2.length < 50) {
                                currentItem.name = prev2
                            }
                        }
                    }
                }

                const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
                if (emailMatch) currentItem.email = emailMatch[0]
            }
            else if (isPassword && currentItem) {
                const parts = line.split(/[:=]/)
                currentItem.password = parts.length > 1 ? parts[1].trim() : line.replace(/password/i, '').replace(/[:=]/, '').trim()
            }
            else if (isUrl) {
                if (currentItem) {
                    const match = line.match(/https?:\/\/[^\s]+/)
                    if (match) currentItem.url = match[0]
                } else if (!globalUrl) {
                    const match = line.match(/https?:\/\/[^\s]+/)
                    if (match) globalUrl = match[0]
                }
            }
        })

        if (currentItem) {
            const item = currentItem as Partial<CredentialItem>
            foundItems.push({
                id: Math.random().toString(36).substr(2, 9),
                name: item.name || 'New Login',
                url: item.url || globalUrl,
                email: item.email || '',
                password: item.password || ''
            })
        }

        // Final Fallback for single line/messy patterns
        if (foundItems.length === 0) {
            let email = '', pass = '', url = ''
            lines.forEach(line => {
                if (line.includes('@') && !email) email = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || ''
                if ((line.includes('pass') || line.includes('pwd')) && !pass) pass = line.split(/[:=]/)[1]?.trim() || ''
                if (line.includes('http') && !url) url = line.match(/https?:\/\/[^\s]+/)?.[0] || ''
            })
            if (email || url) {
                foundItems.push({ id: '1', name: 'Fetched Login', url, email, password: pass })
            }
        }

        if (foundItems.length === 0) {
            toast.error("AI couldn't find distinct credentials. Try formatting like 'Name \n Email: ... \n Pass: ...'")
            return
        }

        // Replace or Append
        const isEmpty = credentials.length === 1 && !credentials[0].email && !credentials[0].url
        if (isEmpty) {
            setCredentials(foundItems)
        } else {
            setCredentials(prev => [...prev, ...foundItems])
        }

        toast.success(`Successfully fetched ${foundItems.length} login ${foundItems.length === 1 ? 'entry' : 'entries'}`)
        setIsAiOpen(false)
        setAiText("")
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[550px] overflow-y-auto flex flex-col p-0 bg-white">
                <SheetHeader className="p-6 border-b bg-slate-50/50 sticky top-0 z-30">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Lock className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <SheetTitle className="text-xl">{project?.name}</SheetTitle>
                                <SheetDescription className="text-xs">Manage project logins and access</SheetDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAiOpen(!isAiOpen)}
                                className={cn(
                                    "rounded-full transition-all border-dashed py-5 px-4",
                                    isAiOpen ? "bg-primary text-white border-primary" : "text-primary hover:bg-primary/5 shadow-sm"
                                )}
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest">AI Fetch</span>
                            </Button>
                        </div>
                    </div>

                    {isAiOpen && (
                        <div className="mt-4 p-4 rounded-2xl bg-primary/[0.03] border border-primary/10 animate-in slide-in-from-top-4 duration-500 shadow-inner">
                            <Label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 block">Paste logins from email, chat, or files</Label>
                            <Textarea
                                placeholder="Example:&#10;Admin Dashboard&#10;Email: admin@test.com&#10;Password: 123456"
                                className="min-h-[140px] bg-white border-primary/20 rounded-xl text-sm focus-visible:ring-primary/20 placeholder:text-slate-300"
                                value={aiText}
                                onChange={(e) => setAiText(e.target.value)}
                            />
                            <div className="flex justify-between items-center mt-3">
                                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Smart multi-block detection active</p>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setIsAiOpen(false)} className="rounded-xl text-[10px] uppercase font-bold text-slate-500">Cancel</Button>
                                    <Button size="sm" onClick={handleAiParse} className="rounded-xl text-[10px] uppercase font-bold px-6 shadow-lg shadow-primary/20">Fetch & Add</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetHeader>

                <div className="flex-1 p-6 space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">Credential List</h4>
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                            <span className="text-[10px] font-bold text-slate-400 italic">{credentials.length} Items</span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 rounded-xl text-[9px] font-black uppercase text-rose-400 hover:text-rose-500 hover:bg-rose-50 px-3">
                                <Trash className="h-3 w-3 mr-1.5" />
                                Clear All
                            </Button>
                            <Button variant="ghost" size="icon" onClick={addItem} className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-primary/10 hover:text-primary transition-all shadow-sm">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {credentials.map((item, index) => (
                            <div key={item.id} className="p-5 rounded-[2.5rem] border border-slate-100 bg-slate-50/50 space-y-4 relative group transition-all hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 hover:border-slate-200 animate-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="h-8 w-8 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-[11px] font-black text-slate-400 shadow-sm">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>
                                    <Input
                                        value={item.name}
                                        onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                                        className="h-9 border-transparent bg-transparent font-black text-sm p-0 focus-visible:ring-0 text-slate-800 placeholder:text-slate-300 uppercase tracking-wide"
                                        placeholder="Entry Name (e.g. Admin Panel)"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeItem(item.id)}
                                        className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 hover:text-rose-500 hover:scale-105 active:scale-95"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="grid gap-3">
                                    <div className="flex gap-2 group/field">
                                        <div className="flex-1 flex gap-2 bg-white border border-slate-100 rounded-2xl px-3 hover:border-primary/30 transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/[0.03]">
                                            <div className="flex items-center text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0 w-8">URL</div>
                                            <Input
                                                placeholder="https://client-site.com/login"
                                                value={item.url}
                                                onChange={(e) => handleFieldChange(item.id, 'url', e.target.value)}
                                                className="border-none bg-transparent h-11 text-xs focus-visible:ring-0 px-0"
                                            />
                                        </div>
                                        {item.url && (
                                            <Button variant="outline" size="icon" onClick={() => window.open(item.url, '_blank')} className="h-11 w-11 shrink-0 rounded-2xl border-slate-100 bg-white hover:bg-primary/5 hover:border-primary/30 transition-all shadow-sm">
                                                <ExternalLink className="h-4 w-4 text-slate-400" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex gap-2 bg-white border border-slate-100 rounded-2xl px-3 hover:border-primary/30 transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/[0.03]">
                                            <div className="flex items-center text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0 w-5">ID</div>
                                            <Input
                                                placeholder="Email / User"
                                                value={item.email}
                                                onChange={(e) => handleFieldChange(item.id, 'email', e.target.value)}
                                                className="border-none bg-transparent h-11 text-xs focus-visible:ring-0 px-0"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => handleCopy(item.email)} className="h-8 w-8 my-auto shrink-0 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                                                <Copy className="h-3.5 w-3.5 text-slate-400" />
                                            </Button>
                                        </div>

                                        <div className="flex gap-2 bg-white border border-slate-100 rounded-2xl px-3 hover:border-primary/30 transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/[0.03]">
                                            <div className="flex items-center text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0 w-5">PW</div>
                                            <Input
                                                type="text"
                                                placeholder="Password"
                                                value={item.password}
                                                onChange={(e) => handleFieldChange(item.id, 'password', e.target.value)}
                                                className="border-none bg-transparent h-11 text-xs focus-visible:ring-0 px-0"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => handleCopy(item.password || "")} className="h-8 w-8 my-auto shrink-0 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                                                <Copy className="h-3.5 w-3.5 text-slate-400" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Button
                        variant="ghost"
                        onClick={addItem}
                        className="w-full py-10 border-2 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300 hover:bg-slate-50 hover:border-primary/20 hover:text-primary transition-all group active:scale-[0.98]"
                    >
                        <div className="flex flex-col items-center gap-2">
                            <Plus className="h-6 w-6 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Add Another Workspace</span>
                        </div>
                    </Button>
                </div>

                <SheetFooter className="p-6 border-t bg-white sticky bottom-0 z-30">
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/30 transition-all active:scale-[0.98] hover:translate-y-[-2px]"
                    >
                        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save All Credentials
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
