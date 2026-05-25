import { useState, useRef, useCallback, useEffect } from "react"
import { format } from "date-fns"
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
import { Sparkles, Loader2, Check, ClipboardList, Upload, FileText, X, ImageIcon, Clipboard } from "lucide-react"
import { projectService } from "src/firebase/projectService"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface AITaskExtractorProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    currentMilestones: any[]
    currentEmployee?: any
}

interface ScreenshotItem {
    id: string
    dataUrl: string
    mimeType: string
    name: string
}

export function AITaskExtractor({ open, onOpenChange, projectId, currentMilestones, currentEmployee }: AITaskExtractorProps) {
    const [text, setText] = useState("")
    const [loading, setLoading] = useState(false)
    const [extractedTasks, setExtractedTasks] = useState<{ task: string, description: string }[]>([])
    const [selectedTasks, setSelectedTasks] = useState<number[]>([])
    const [step, setStep] = useState(1) // 1: Input, 2: Review
    const [mode, setMode] = useState<'text' | 'document' | 'screenshots'>('text')
    const [uploadedFile, setUploadedFile] = useState<File | null>(null)
    const [fileExtracting, setFileExtracting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Screenshots state
    const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([])
    const screenshotDropRef = useRef<HTMLDivElement>(null)

    const extractTextFromFile = async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop()?.toLowerCase()

        if (ext === 'txt') {
            return await file.text()
        }

        if (ext === 'pdf') {
            const pdfjsLib = await import('pdfjs-dist')
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
            let fullText = ''
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i)
                const content = await page.getTextContent()
                const strings = content.items.map((item: any) => item.str)
                fullText += strings.join(' ') + '\n'
            }
            return fullText
        }

        if (ext === 'docx') {
            const mammoth = await import('mammoth')
            const arrayBuffer = await file.arrayBuffer()
            const result = await mammoth.extractRawText({ arrayBuffer })
            return result.value
        }

        throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.')
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!['pdf', 'txt', 'docx'].includes(ext || '')) {
            toast.error("Unsupported file type. Please upload PDF, DOCX, or TXT.")
            return
        }

        setUploadedFile(file)
        setFileExtracting(true)

        try {
            const extracted = await extractTextFromFile(file)
            if (extracted.trim().length < 10) {
                toast.error("Could not extract enough text from this file.")
                setUploadedFile(null)
            } else {
                setText(extracted)
                toast.success(`Extracted ${extracted.length} characters from ${file.name}`)
            }
        } catch (error: any) {
            console.error("File extraction error:", error)
            toast.error(error.message || "Failed to extract text from the file.")
            setUploadedFile(null)
        } finally {
            setFileExtracting(false)
        }
    }

    const handleRemoveFile = () => {
        setUploadedFile(null)
        setText("")
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // --- Screenshot helpers ---
    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    const addScreenshotFiles = useCallback(async (files: File[]) => {
        const imageFiles = files.filter(f => f.type.startsWith('image/'))
        if (imageFiles.length === 0) {
            toast.error("No image files found. Please paste or drop screenshots.")
            return
        }

        const totalAfter = screenshots.length + imageFiles.length
        if (totalAfter > 10) {
            toast.error(`Maximum 10 screenshots allowed. You already have ${screenshots.length}.`)
            return
        }

        const newItems: ScreenshotItem[] = []
        for (const file of imageFiles) {
            const dataUrl = await fileToDataUrl(file)
            newItems.push({
                id: `ss-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                dataUrl,
                mimeType: file.type,
                name: file.name || `Screenshot ${screenshots.length + newItems.length + 1}`
            })
        }

        setScreenshots(prev => [...prev, ...newItems])
        toast.success(`Added ${newItems.length} screenshot${newItems.length > 1 ? 's' : ''}`)
    }, [screenshots.length])

    const removeScreenshot = (id: string) => {
        setScreenshots(prev => prev.filter(s => s.id !== id))
    }

    // Handle paste event for screenshots
    const handlePaste = useCallback((e: ClipboardEvent) => {
        if (mode !== 'screenshots') return

        const items = e.clipboardData?.items
        if (!items) return

        const imageFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) imageFiles.push(file)
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault()
            addScreenshotFiles(imageFiles)
        }
    }, [mode, addScreenshotFiles])

    // Attach paste listener when in screenshot mode and sheet is open
    useEffect(() => {
        if (open && mode === 'screenshots') {
            document.addEventListener('paste', handlePaste)
            return () => document.removeEventListener('paste', handlePaste)
        }
    }, [open, mode, handlePaste])

    // Handle drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const files = Array.from(e.dataTransfer.files)
        addScreenshotFiles(files)
    }, [addScreenshotFiles])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleExtract = async () => {
        if (mode === 'screenshots') {
            // Extract from screenshots
            if (screenshots.length === 0) {
                toast.error("Please paste or drop at least one screenshot")
                return
            }

            setLoading(true)
            try {
                const images = screenshots.map(s => ({
                    base64: s.dataUrl,
                    mimeType: s.mimeType
                }))
                const result = await projectService.extractTasksFromImages(images)
                if (result.success && result.tasks && result.tasks.length > 0) {
                    setExtractedTasks(result.tasks)
                    setSelectedTasks(result.tasks.map((_, i) => i))
                    setStep(2)
                } else {
                    toast.error("AI couldn't find any actionable tasks in the screenshots. Try different images.")
                }
            } catch (error) {
                console.error("AI Screenshot Extraction failed:", error)
                toast.error("AI processing failed. Please try again.")
            } finally {
                setLoading(false)
            }
        } else {
            // Extract from text
            if (!text.trim() || text.trim().length < 10) {
                toast.error("Please enter at least 10 characters to extract tasks from")
                return
            }

            setLoading(true)
            try {
                const result = await projectService.extractTasks(text)
                if (result.success && result.tasks) {
                    setExtractedTasks(result.tasks)
                    setSelectedTasks(result.tasks.map((_, i) => i))
                    setStep(2)
                } else {
                    toast.error("AI couldn't find any actionable tasks. Try providing more detail.")
                }
            } catch (error) {
                console.error("AI Extraction failed:", error)
                toast.error("AI processing failed. Please try again.")
            } finally {
                setLoading(false)
            }
        }
    }

    const toggleTask = (index: number) => {
        setSelectedTasks(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        )
    }

    const handleAddTasks = async () => {
        const tasksToAdd = extractedTasks.filter((_, i) => selectedTasks.includes(i))

        if (tasksToAdd.length === 0) {
            toast.error("Please select at least one task to add")
            return
        }

        setLoading(true)
        try {
            const newMilestones = tasksToAdd.map(t => ({
                id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                task: t.task,
                description: t.description,
                status: "Pending",
                date: format(new Date(), 'yyyy-MM-dd'),
                assignedTo: currentEmployee ? { name: currentEmployee.name, avatar: currentEmployee.avatar || '' } : null,
                notes: [],
                attachments: []
            }))

            await projectService.updateProject(projectId, {
                milestones: [...currentMilestones, ...newMilestones]
            })

            toast.success(`Successfully added ${tasksToAdd.length} tasks to the project!`)
            handleClose()
        } catch (error) {
            toast.error("Failed to add tasks to the project")
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        onOpenChange(false)
        setText("")
        setExtractedTasks([])
        setSelectedTasks([])
        setStep(1)
        setMode('text')
        setUploadedFile(null)
        setScreenshots([])
    }

    const canExtract = mode === 'screenshots'
        ? screenshots.length > 0
        : text.trim().length >= 10

    return (
        <Sheet open={open} onOpenChange={(val) => !val && handleClose()}>
            <SheetContent side="right" className="sm:max-w-[500px] gap-0 p-0 flex flex-col bg-white border-l border-slate-100 shadow-2xl">
                <div className="p-8 pb-4">
                    <SheetHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">
                                <Sparkles className="h-6 w-6 text-primary" />
                            </div>
                            <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900">AI Task Magic</SheetTitle>
                        </div>
                        <SheetDescription className="text-sm font-medium text-slate-500">
                            Paste text, upload a document, or paste screenshots to auto-generate tasks.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {step === 1 ? (
                        <div className="space-y-4 h-full flex flex-col">
                            {/* Mode Tabs */}
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                    onClick={() => setMode('text')}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5",
                                        mode === 'text'
                                            ? "bg-white text-primary shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    <ClipboardList className="h-3.5 w-3.5" />
                                    Text
                                </button>
                                <button
                                    onClick={() => setMode('document')}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5",
                                        mode === 'document'
                                            ? "bg-white text-primary shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    <Upload className="h-3.5 w-3.5" />
                                    Document
                                </button>
                                <button
                                    onClick={() => setMode('screenshots')}
                                    className={cn(
                                        "flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5",
                                        mode === 'screenshots'
                                            ? "bg-white text-primary shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Screenshots
                                </button>
                            </div>

                            {mode === 'text' ? (
                                <div className="relative flex-1">
                                    <Textarea
                                        placeholder="Paste transcript or notes here... (e.g. 'The client wants the login page redesigned...')"
                                        className="min-h-[400px] h-full bg-white border-slate-200 focus:border-primary focus:ring-primary/20 transition-all text-sm leading-relaxed resize-none rounded-2xl p-6 shadow-sm"
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                    />
                                    <div className="absolute bottom-4 right-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        {text.length} chars
                                    </div>
                                </div>
                            ) : mode === 'document' ? (
                                <div className="flex-1 flex flex-col gap-4">
                                    {/* Hidden file input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.txt,.docx"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />

                                    {!uploadedFile ? (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1 min-h-[300px] flex flex-col items-center justify-center gap-4 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all group"
                                        >
                                            <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                                <Upload className="h-8 w-8 text-slate-300 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-slate-600">Click to upload a document</p>
                                                <p className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, TXT</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4">
                                            {/* File card */}
                                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                    <FileText className="h-6 w-6 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{uploadedFile.name}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={handleRemoveFile}
                                                    className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {fileExtracting ? (
                                                <div className="flex items-center justify-center gap-3 py-8">
                                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                    <span className="text-sm font-bold text-slate-500">Reading document...</span>
                                                </div>
                                            ) : text && (
                                                <div className="relative">
                                                    <Textarea
                                                        value={text}
                                                        onChange={(e) => setText(e.target.value)}
                                                        className="min-h-[250px] bg-white border-slate-200 focus:border-primary focus:ring-primary/20 transition-all text-sm leading-relaxed resize-none rounded-2xl p-6 shadow-sm"
                                                        placeholder="Extracted text will appear here..."
                                                    />
                                                    <div className="absolute bottom-4 right-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                        {text.length} chars
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Screenshots Mode */
                                <div className="flex-1 flex flex-col gap-4">
                                    {screenshots.length === 0 ? (
                                        <div
                                            ref={screenshotDropRef}
                                            onDrop={handleDrop}
                                            onDragOver={handleDragOver}
                                            className="flex-1 min-h-[350px] flex flex-col items-center justify-center gap-5 border-2 border-dashed border-slate-200 rounded-2xl cursor-default hover:border-primary/40 hover:bg-primary/[0.02] transition-all group"
                                        >
                                            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-violet-50 to-blue-50 flex items-center justify-center group-hover:from-violet-100 group-hover:to-blue-100 transition-colors border border-violet-100/50">
                                                <Clipboard className="h-9 w-9 text-violet-400 group-hover:text-violet-500 transition-colors" />
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="text-base font-bold text-slate-700">Paste Screenshots Here</p>
                                                <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
                                                    Copy screenshots to clipboard and press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono font-bold">Ctrl+V</kbd> to paste them here
                                                </p>
                                                <p className="text-[11px] text-slate-400 font-medium pt-1">
                                                    or drag & drop image files
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="h-px w-8 bg-slate-200" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Max 10 images</span>
                                                <div className="h-px w-8 bg-slate-200" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Drop zone header */}
                                            <div
                                                onDrop={handleDrop}
                                                onDragOver={handleDragOver}
                                                className="flex items-center justify-between p-3 bg-violet-50/50 border border-violet-100 rounded-xl"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <ImageIcon className="h-4 w-4 text-violet-500" />
                                                    <span className="text-xs font-bold text-violet-700">
                                                        {screenshots.length} screenshot{screenshots.length > 1 ? 's' : ''} added
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-violet-400 font-medium">
                                                        Paste more with Ctrl+V
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setScreenshots([])}
                                                        className="h-7 px-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 hover:text-red-700"
                                                    >
                                                        Clear All
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Screenshots grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                {screenshots.map((ss) => (
                                                    <div
                                                        key={ss.id}
                                                        className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm hover:shadow-md transition-all"
                                                    >
                                                        <div className="aspect-video bg-slate-100 relative overflow-hidden">
                                                            <img
                                                                src={ss.dataUrl}
                                                                alt={ss.name}
                                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                            />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeScreenshot(ss.id)}
                                                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/50 text-white hover:bg-red-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                        <div className="px-2 py-1.5 bg-white border-t">
                                                            <p className="text-[10px] font-medium text-slate-500 truncate">{ss.name}</p>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Add more zone */}
                                                {screenshots.length < 10 && (
                                                    <div
                                                        onDrop={handleDrop}
                                                        onDragOver={handleDragOver}
                                                        className="aspect-video rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-default hover:border-violet-300 hover:bg-violet-50/30 transition-all"
                                                    >
                                                        <Clipboard className="h-5 w-5 text-slate-300" />
                                                        <span className="text-[10px] font-bold text-slate-400">Paste / Drop</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <ClipboardList className="h-4 w-4" />
                                    Extracted Tasks ({selectedTasks.length}/{extractedTasks.length})
                                </h4>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold uppercase px-3 hover:bg-slate-50" onClick={() => setStep(1)}>
                                    <ArrowLeft className="h-3 w-3 mr-2" /> Edit Source
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {extractedTasks.map((t, i) => (
                                    <div
                                        key={i}
                                        onClick={() => toggleTask(i)}
                                        className={cn(
                                            "group flex items-start gap-4 p-5 rounded-2xl border transition-all cursor-pointer",
                                            selectedTasks.includes(i)
                                                ? "bg-white border-primary shadow-lg ring-1 ring-primary/10"
                                                : "bg-white border-slate-100 opacity-60 hover:opacity-100 hover:border-slate-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-6 w-6 rounded-lg flex items-center justify-center mt-0.5 transition-colors",
                                            selectedTasks.includes(i) ? "bg-primary text-white shadow-sm" : "bg-slate-50 text-slate-300 group-hover:bg-slate-100"
                                        )}>
                                            {selectedTasks.includes(i) && <Check className="h-4 w-4 stroke-[3px]" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-[15px] text-slate-900 leading-tight mb-1.5">{t.task}</p>
                                            <p className="text-xs text-slate-500 font-medium leading-relaxed">{t.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <SheetFooter className="p-8 bg-white border-t border-slate-50 mt-auto">
                    <div className="flex items-center gap-4 w-full">
                        <Button variant="outline" onClick={handleClose} disabled={loading} className="flex-1 rounded-xl h-12 font-bold text-slate-600">
                            Cancel
                        </Button>

                        {step === 1 ? (
                            <Button
                                onClick={handleExtract}
                                disabled={loading || !canExtract || fileExtracting}
                                className="flex-[2] bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-12 shadow-lg shadow-primary/20"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        {mode === 'screenshots' ? 'Analyzing...' : 'Thinking...'}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-5 w-5 fill-white" />
                                        {mode === 'screenshots' ? `Extract from ${screenshots.length} Image${screenshots.length !== 1 ? 's' : ''}` : 'Extract Tasks'}
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleAddTasks}
                                disabled={loading || selectedTasks.length === 0}
                                className="flex-[2] bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-12 shadow-lg shadow-primary/20"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        Add {selectedTasks.length} Tasks
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

function ArrowLeft({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
        </svg>
    )
}
