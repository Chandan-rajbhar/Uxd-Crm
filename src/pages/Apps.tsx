import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AddAppSheet } from "@/components/AddAppSheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Sparkles, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { generateAIContent } from "@/lib/gemini"
import TextareaAutosize from "react-textarea-autosize"
import { useApps } from "src/hooks/useApps"
import { appsService } from "src/firebase/appsService"
import { useEmployees } from "src/hooks/useEmployees"

// App Store / Play Store Status Options
const STATUS_OPTIONS = [
    "Deployed - Live",
    "Update Deployed - Live",
    "In review",
    "In review - Reject",
    "Deployed - In Review",
    "Pending",
    "Rejected",
    "UPDATE Deployed - live",
    "Deployed -Live",
    "Deployed - Live"
]

// Overall Project Status Options
const PROJECT_STATUS_OPTIONS = [
    "In Progress",
    "Pending",
    "Completed"
]

export default function AppsPage() {
    const navigate = useNavigate()
    const { apps, loading } = useApps()
    const { employees } = useEmployees()

    // AI Analysis State
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false)
    const [currentAnalyzingApp, setCurrentAnalyzingApp] = useState<string | null>(null)
    const [rejectionLog, setRejectionLog] = useState("")
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    const getStatusColor = (status: string) => {
        if (!status) return "outline"
        const lower = status.toLowerCase()
        if (lower.includes("reject")) return "destructive"
        if (lower.includes("review")) return "warning"
        if (lower.includes("update") || lower.includes("deployed") || lower.includes("live")) return "default"
        return "secondary"
    }

    const getProjectStatusColor = (status: string) => {
        switch (status) {
            case "In Progress": return "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-0";
            case "Pending": return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 border-0";
            case "Completed": return "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-0";
            default: return "border-0";
        }
    }

    const handleUpdateApp = async (id: string, field: string, value: any) => {
        try {
            await appsService.updateApp(id, { [field]: value });
        } catch (error) {
            console.error("Failed to update app:", error);
        }
    }

    const openAnalysisDialog = (appId: string) => {
        setCurrentAnalyzingApp(appId)
        setRejectionLog("")
        setIsAnalysisOpen(true)
    }

    const handleAnalyze = async () => {
        if (!rejectionLog.trim()) return;

        setIsAnalyzing(true);
        try {
            const prompt = `
                Analyze the following mobile app store rejection log. 
                Extract the specific reasons for rejection. 
                Summarize them into 1-2 concise sentences suitable for a table cell. 
                Be highly accurate and factual based ONLY on the provided log. 
                Return ONLY the summary text, no conversational filler.

                Rejection Log:
                ${rejectionLog}
            `;

            const summary = await generateAIContent(prompt);

            // Update the app's rejection issue with the summary
            if (currentAnalyzingApp && summary) {
                await handleUpdateApp(currentAnalyzingApp, 'rejectionIssue', summary.trim());
                setIsAnalysisOpen(false);
            }
        } catch (error) {
            console.error("Analysis failed", error);
        } finally {
            setIsAnalyzing(false);
        }
    }

    return (
        <div className="flex flex-1 flex-col space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-2xl font-bold tracking-tight">Mobile Apps Status</h1>
                    </div>
                    <p className="text-muted-foreground ml-10">
                        Current deployment status for Android and iOS applications.
                    </p>
                </div>
                {apps.length > 0 && <AddAppSheet />}
            </div>

            <div className="">
                {loading ? (
                    <div className="flex items-center justify-center p-8 h-[60vh]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : apps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 h-[60vh] text-center animate-in fade-in-50 zoom-in-95 duration-300">
                        <div className="bg-primary/10 p-6 rounded-full mb-4">
                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-primary"
                            >
                                <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                                <path d="M12 18h.01" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight mb-2">No mobile apps tracked</h2>
                        <p className="text-muted-foreground max-w-[450px] mb-8 text-sm sm:text-base leading-relaxed">
                            You haven't added any mobile applications yet. Start tracking your deployment status across Android and iOS platforms in one place.
                        </p>
                        <AddAppSheet
                            trigger={
                                <Button size="lg" className="h-11 px-8">
                                    <Plus className="mr-2 h-5 w-5" /> Add First App
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="py-3 w-[250px]">Mobile Apps</TableHead>
                                <TableHead className="py-3">Android</TableHead>
                                <TableHead className="py-3">iOS</TableHead>
                                <TableHead className="py-3 w-[350px]">Rejection Issue</TableHead>
                                <TableHead className="py-3 w-[200px]">Developer</TableHead>
                                <TableHead className="py-3 w-[150px]">Status</TableHead>
                                <TableHead className="py-3 text-right">Links</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {apps.map((app) => (
                                <TableRow key={app.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="py-3 font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border bg-muted/30">
                                                <AvatarImage src={app.logo} />
                                                <AvatarFallback className="text-xs font-medium text-muted-foreground bg-transparent">
                                                    {app.name.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="font-semibold">{app.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Select
                                            value={app.android || ""}
                                            onValueChange={(val) => handleUpdateApp(app.id, 'android', val)}
                                        >
                                            <SelectTrigger
                                                className="h-8 border-0 p-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0 w-auto min-w-[140px]"
                                                icon={null}
                                            >
                                                {app.android ? (
                                                    <Badge
                                                        variant={getStatusColor(app.android) === 'destructive' ? 'destructive' : 'secondary'}
                                                        className={`font-normal cursor-pointer pointer-events-none ${app.android.toLowerCase().includes('live') && !app.android.toLowerCase().includes('review') ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' :
                                                            app.android.toLowerCase().includes('review') && !app.android.toLowerCase().includes('reject') ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' : ''
                                                            }`}
                                                    >
                                                        {app.android}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STATUS_OPTIONS.map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {status}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Select
                                            value={app.ios || ""}
                                            onValueChange={(val) => handleUpdateApp(app.id, 'ios', val)}
                                        >
                                            <SelectTrigger
                                                className="h-8 border-0 p-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0 w-auto min-w-[140px]"
                                                icon={null}
                                            >
                                                {app.ios ? (
                                                    <Badge
                                                        variant={getStatusColor(app.ios) === 'destructive' ? 'destructive' : 'secondary'}
                                                        className={`font-normal cursor-pointer pointer-events-none ${app.ios.toLowerCase().includes('live') && !app.ios.toLowerCase().includes('review') && !app.ios.toLowerCase().includes('reject') ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' :
                                                            app.ios.toLowerCase().includes('reject') ? '' :
                                                                app.ios.toLowerCase().includes('review') ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' : ''
                                                            }`}
                                                    >
                                                        {app.ios}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STATUS_OPTIONS.map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {status}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-1">
                                            <TextareaAutosize
                                                value={app.rejectionIssue || ""}
                                                onChange={(e) => handleUpdateApp(app.id, 'rejectionIssue', e.target.value)}
                                                className="w-full bg-transparent border-transparent hover:border-input focus:border-input transition-all px-2 py-1 placeholder:text-muted-foreground/50 text-sm resize-none rounded-md border min-h-[40px] focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden"
                                                placeholder="Add issue details..."
                                                minRows={1}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-purple-600 shrink-0"
                                                onClick={() => openAnalysisDialog(app.id)}
                                                title="Analyze rejection with AI"
                                            >
                                                <Sparkles className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Select
                                            value={app.developer || "Unassigned"}
                                            onValueChange={(val) => handleUpdateApp(app.id, 'developer', val)}
                                        >
                                            <SelectTrigger
                                                className="h-8 border-0 p-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0 w-auto min-w-[140px]"
                                                icon={null}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-5 w-5 border">
                                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${app.developer}`} />
                                                        <AvatarFallback>{app.developer?.[0] || '?'}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm truncate">{app.developer || "Unassigned"}</span>
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Unassigned">Unassigned</SelectItem>
                                                {employees.map((emp) => (
                                                    <SelectItem key={emp.id} value={emp.name}>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-5 w-5 border">
                                                                <AvatarImage src={emp.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.name}`} />
                                                                <AvatarFallback>{emp.name[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <span>{emp.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Select
                                            value={app.status || "In Progress"}
                                            onValueChange={(val) => handleUpdateApp(app.id, 'status', val)}
                                        >
                                            <SelectTrigger
                                                className="h-8 border-0 p-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0 w-auto min-w-[120px]"
                                                icon={null}
                                            >
                                                <Badge variant="outline" className={`font-normal rounded-md pointer-events-none px-3 py-1 ${getProjectStatusColor(app.status)}`}>
                                                    {app.status}
                                                </Badge>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PROJECT_STATUS_OPTIONS.map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {status}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {app.android && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-green-600"
                                                    onClick={() => app.playStoreLink && window.open(app.playStoreLink, '_blank')}
                                                    disabled={!app.playStoreLink}
                                                    title={app.playStoreLink ? "View on Play Store" : "No link available"}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                        <path d="M3.609 1.814L13.792 12 3.61 22.186a2.636 2.636 0 01-1.096-1.547l-.014-.055V3.416a2.64 2.64 0 011.11-1.602zM15.225 13.434l3.12 3.12-2.32 1.325c-.71.405-1.58.405-2.29 0l-1.697-.97-6.26-6.26L15.225 13.434zm4.498-1.077l1.795-1.025a1.644 1.644 0 00.002-2.827l-1.797-1.027-3.12 3.12 3.12 1.76zm-5.932-5.932l2.32-1.325c.71-.405 1.58-.405 2.29 0l1.697.97 6.26 6.26-12.57-7.185-3.121-3.12 3.12-1.76z" />
                                                    </svg>
                                                </Button>
                                            )}
                                            {app.ios && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                    onClick={() => app.appStoreLink && window.open(app.appStoreLink, '_blank')}
                                                    disabled={!app.appStoreLink}
                                                    title={app.appStoreLink ? "View on App Store" : "No link available"}
                                                >
                                                    <svg viewBox="0 0 384 512" fill="currentColor" className="w-4 h-4">
                                                        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z" />
                                                    </svg>
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            <Dialog open={isAnalysisOpen} onOpenChange={setIsAnalysisOpen}>
                <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                        <DialogTitle>Analyze Rejection Log</DialogTitle>
                        <DialogDescription>
                            Paste the complete rejection log below. AI will extract the key issues for you.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder="Paste log here..."
                            className="h-[200px]"
                            value={rejectionLog}
                            onChange={(e) => setRejectionLog(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAnalysisOpen(false)}>Cancel</Button>
                        <Button onClick={handleAnalyze} disabled={isAnalyzing || !rejectionLog.trim()}>
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Analyze & Save
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
