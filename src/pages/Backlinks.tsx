import { useState, useRef } from "react"
import {
    Card,
    CardContent
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    Undo,
    Redo,
    Copy,
    Check,
    Trash2,
    Sparkles
} from "lucide-react"
import { generateAIContent } from "@/lib/gemini"
import { toast } from "sonner"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useEffect } from "react"

export default function BacklinksPage() {
    const editorRef = useRef<HTMLDivElement>(null)
    const [url, setUrl] = useState("")
    const [isCopied, setIsCopied] = useState(false)
    const [floatingPos, setFloatingPos] = useState<{ x: number, y: number } | null>(null)
    const [isFloatingOpen, setIsFloatingOpen] = useState(false)
    const [selectionRange, setSelectionRange] = useState<Range | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [backlinkHistory, setBacklinkHistory] = useState<{ url: string, count: number }[]>([])

    // Load history on mount
    useEffect(() => {
        const saved = localStorage.getItem('backlink_history')
        if (saved) setBacklinkHistory(JSON.parse(saved))
    }, [])

    const saveToHistory = (newUrl: string) => {
        const updated = [...backlinkHistory]
        const existing = updated.find(h => h.url === newUrl)
        if (existing) {
            existing.count += 1
        } else {
            updated.unshift({ url: newUrl, count: 1 })
        }
        // Keep only top 5 recent
        const topHistory = updated.sort((a, b) => b.count - a.count).slice(0, 5)
        setBacklinkHistory(topHistory)
        localStorage.setItem('backlink_history', JSON.stringify(topHistory))
    }

    const clearHistory = () => {
        setBacklinkHistory([])
        localStorage.removeItem('backlink_history')
        toast.success("Backlink history cleared")
    }

    const execCommand = (command: string, value: string = "") => {
        if (selectionRange) {
            const selection = window.getSelection()
            selection?.removeAllRanges()
            selection?.addRange(selectionRange)
        }
        document.execCommand(command, false, value)
        editorRef.current?.focus()
        setIsFloatingOpen(false)
    }

    const handleCreateLink = (customUrl?: string, applyToAll: boolean = false) => {
        const targetUrl = customUrl || url
        if (!targetUrl) {
            toast.error("Please enter or select a URL")
            return
        }

        let finalUrl = targetUrl
        if (!/^https?:\/\//i.test(finalUrl)) {
            finalUrl = 'https://' + finalUrl
        }

        const selection = window.getSelection()
        const currentRange = (selection && selection.rangeCount > 0) ? selection.getRangeAt(0) : null
        const activeRange = selectionRange || currentRange

        if (applyToAll && activeRange && editorRef.current) {
            const selectedText = activeRange.toString().trim()
            if (selectedText) {
                const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                // Enhanced regex: 
                // Skip content inside <a> tags completely
                // Skip content inside any HTML tag opening/closing
                const tagRegex = new RegExp(`(<a [^>]*>[^<]*<\/a>)|(<[^>]+>)|(${escapedText})`, 'gi')
                const html = editorRef.current.innerHTML
                let matchCount = 0
                const newHtml = html.replace(tagRegex, (match, p1, p2, _p3) => {
                    if (p1 || p2) return match;
                    matchCount++
                    return `<a href="${finalUrl}" target="_blank">${match}</a>`;
                })
                editorRef.current.innerHTML = newHtml
                toast.success(`Linked ${matchCount} ${matchCount === 1 ? 'instance' : 'instances'} of "${selectedText}"`)
            } else {
                toast.error("No text selected to apply to all")
            }
        } else if (activeRange) {
            if (selection) {
                selection.removeAllRanges()
                selection.addRange(activeRange)
            }
            document.execCommand("createLink", false, finalUrl)
            toast.success("Link created")
        }

        saveToHistory(finalUrl)
        setUrl("")
        setIsFloatingOpen(false)
        setSelectionRange(null)
    }

    const handleCopyHtml = () => {
        if (!editorRef.current) return
        const html = editorRef.current.innerHTML
        navigator.clipboard.writeText(html)
        setIsCopied(true)
        toast.success("HTML copied to clipboard")
        setTimeout(() => setIsCopied(false), 2000)
    }

    const handleMouseUp = () => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setFloatingPos({
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY - 10
        })
        setSelectionRange(range.cloneRange())
        setIsFloatingOpen(true)
    }

    const handleDoubleClick = () => {
        const selection = window.getSelection()
        if (!selection) return

        try {
            // Automatic word selection on double click
            (selection as any).modify("move", "backward", "word");
            (selection as any).modify("extend", "forward", "word");
        } catch (err) {
            console.log("Modify select not supported")
        }

        if (!selection.isCollapsed) {
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            setFloatingPos({
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY - 10
            })
            setSelectionRange(range.cloneRange())
            setIsFloatingOpen(true)
        }
    }

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        const anchor = target.closest('a')

        if (anchor && anchor.href) {
            e.preventDefault()
            window.open(anchor.href, '_blank')
        }
    }

    const handleGenerateBlog = async () => {
        if (!editorRef.current) return

        const inputText = editorRef.current.innerText.trim()

        if (!inputText || inputText.length < 3) {
            toast.error("Please type your topic or some draft text in the editor first")
            return
        }

        setIsGenerating(true)
        const toastId = toast.loading("AI is expanding your text into a blog...")

        try {
            const prompt = `Act as a professional blog writer. Based on the following input, write a comprehensive, high-quality, and SEO-optimized blog post:
            
            INPUT: "${inputText}"
            
            Requirements:
            1. Return ONLY the HTML content.
            2. Use <h2> for subheadings and <p> for paragraphs.
            3. Make it engaging and professional.
            4. Do not include <html>, <head>, or <body> tags.`

            const content = await generateAIContent(prompt)
            if (editorRef.current) {
                const cleanHTML = content.replace(/```html|```/g, "").trim()
                editorRef.current.innerHTML = cleanHTML
                toast.success("Blog generated from your text!", { id: toastId })
            }
        } catch (error) {
            console.error("AI Generation error:", error)
            toast.error("Failed to generate blog", { id: toastId })
        } finally {
            setIsGenerating(false)
        }
    }

    const handleClear = () => {
        if (editorRef.current) {
            editorRef.current.innerHTML = ""
        }
    }

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-slate-50/50">
            {/* Inline Popover Trigger */}
            {floatingPos && (
                <div
                    style={{
                        position: 'absolute',
                        left: floatingPos.x,
                        top: floatingPos.y,
                        width: '1px',
                        height: '1px',
                        zIndex: 50,
                        pointerEvents: 'none'
                    }}
                >
                    <Popover open={isFloatingOpen} onOpenChange={setIsFloatingOpen}>
                        <PopoverTrigger asChild>
                            <div className="w-px h-px" />
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-80 p-0 shadow-2xl border-slate-200 overflow-hidden rounded-xl bg-white"
                            side="top"
                            align="center"
                            sideOffset={10}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <div className="p-3 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Paste URL..."
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="h-9 border-slate-200 focus-visible:ring-primary/20 text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleCreateLink()
                                            if (e.key === "Escape") setIsFloatingOpen(false)
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={() => handleCreateLink()}
                                        className="h-9 w-9 p-0 shrink-0 rounded-lg"
                                    >
                                        <Check className="h-4 w-4" />
                                    </Button>
                                </div>

                                {backlinkHistory.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between ml-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggestions</p>
                                            <button
                                                onClick={clearHistory}
                                                className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-red-500"
                                                title="Clear History"
                                            >
                                                <Undo className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {backlinkHistory.map((h, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setUrl(h.url)}
                                                    className="text-[11px] bg-slate-50 hover:bg-primary/5 hover:text-primary text-slate-600 px-2 py-1 rounded-md border border-slate-100 transition-colors truncate max-w-[150px]"
                                                    title={h.url}
                                                >
                                                    {h.url.replace(/^https?:\/\//, '')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-slate-50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-[11px] h-7 text-primary hover:text-primary hover:bg-primary/5 font-bold"
                                        onClick={() => handleCreateLink(url, true)}
                                    >
                                        <Sparkles className="h-3 w-3 mr-2" />
                                        Apply to all instances
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Backlink Creator</h2>
                    <p className="text-muted-foreground mt-1">
                        AI-powered blog and backlink generation suite.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={handleClear} className="text-slate-600 bg-white hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors" title="Clear Editor">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" onClick={handleCopyHtml} className="bg-primary shadow-sm hover:bg-primary/90" title="Copy HTML Content">
                        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-12">
                <Card className="md:col-span-12 shadow-sm border-slate-200 overflow-hidden relative">
                    <CardContent className="p-0 bg-white">
                        {/* Integrated AI Toolbar */}
                        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50/50">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isGenerating}
                                onClick={handleGenerateBlog}
                                className="flex items-center gap-2 px-3 mr-2 bg-white rounded-md border border-slate-200 shadow-sm h-8 relative overflow-hidden group hover:bg-primary/5 hover:border-primary/20 transition-all"
                            >
                                {isGenerating ? (
                                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2 transition-all">
                                        <div className="flex gap-1">
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">AI Writing</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 animate-in fade-in transition-all">
                                        <Sparkles className="h-3.5 w-3.5 text-primary group-hover:rotate-12 transition-transform" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auto Generate</span>
                                    </div>
                                )}
                            </Button>

                            {/* Toolbar */}
                            <div className="w-px h-6 bg-slate-200 mx-2" />
                            <ToolbarButton onClick={() => execCommand("undo")} icon={<Undo className="h-4 w-4" />} tooltip="Undo" />
                            <ToolbarButton onClick={() => execCommand("redo")} icon={<Redo className="h-4 w-4" />} tooltip="Redo" />
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            <ToolbarButton onClick={() => execCommand("bold")} icon={<Bold className="h-4 w-4" />} tooltip="Bold" />
                            <ToolbarButton onClick={() => execCommand("italic")} icon={<Italic className="h-4 w-4" />} tooltip="Italic" />
                            <ToolbarButton onClick={() => execCommand("formatBlock", "H2")} icon={<span className="font-bold text-xs">H2</span>} tooltip="Heading 2" />
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            <ToolbarButton onClick={() => execCommand("insertUnorderedList")} icon={<List className="h-4 w-4" />} tooltip="Bullet List" />
                            <ToolbarButton onClick={() => execCommand("insertOrderedList")} icon={<ListOrdered className="h-4 w-4" />} tooltip="Numbered List" />
                            <ToolbarButton onClick={() => execCommand("formatBlock", "blockquote")} icon={<Quote className="h-4 w-4" />} tooltip="Quote" />
                        </div>

                        {/* Editable Area */}
                        <div
                            ref={editorRef}
                            contentEditable
                            className="min-h-[600px] p-10 focus:outline-none prose prose-slate max-w-none text-slate-800"
                            style={{
                                outline: 'none',
                                fontSize: '18px',
                                lineHeight: '1.7',
                                fontFamily: 'inherit',
                            }}
                            onMouseUp={handleMouseUp}
                            onDoubleClick={handleDoubleClick}
                            onClick={handleClick}
                            onKeyDown={(e) => {
                                // Keyboard shortcuts
                                if (e.ctrlKey || e.metaKey) {
                                    if (e.key === 'b') { e.preventDefault(); execCommand('bold'); }
                                    if (e.key === 'i') { e.preventDefault(); execCommand('italic'); }
                                }
                                if (e.key === 'Escape') setIsFloatingOpen(false)
                            }}
                        />
                        <style>{`
                            [contenteditable] a {
                                color: #2563eb;
                                text-decoration: underline;
                                cursor: pointer;
                            }
                            [contenteditable] blockquote {
                                border-left: 4px solid #e2e8f0;
                                padding-left: 1rem;
                                font-style: italic;
                                color: #64748b;
                            }
                            [contenteditable] h2 {
                                font-size: 1.5rem;
                                font-weight: 700;
                                margin-top: 1.5rem;
                                margin-bottom: 0.75rem;
                            }
                            [contenteditable] ul {
                                list-style-type: disc;
                                padding-left: 1.5rem;
                            }
                            [contenteditable] ol {
                                list-style-type: decimal;
                                padding-left: 1.5rem;
                            }
                        `}</style>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function ToolbarButton({ onClick, icon, tooltip }: { onClick: () => void, icon: React.ReactNode, tooltip: string }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            onClick={onClick}
            title={tooltip}
        >
            {icon}
        </Button>
    )
}
