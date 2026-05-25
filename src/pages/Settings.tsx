import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { updatePassword, signOut } from "firebase/auth"
import { httpsCallable } from "firebase/functions"
import { functions, auth } from "@/firebase/config"
import { toast } from "sonner"
import { 
    Loader2, 
    Monitor, 
    Fingerprint,
    Wrench,
    CheckCircle2,
    AlertCircle,
    Eye,
    EyeOff,
    Database,
    RefreshCw
} from "lucide-react"
import { subscribeToActiveSessions } from "@/firebase/sessionService"
import { settingsService } from "@/firebase/settingsService"
import { assetIssueService, type AssetIssue } from "@/firebase/assetIssueService"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog"

export default function SettingsPage() {
    const { user, role, mfaEnabled, refreshRole } = useAuth()
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [mfaLoading, setMfaLoading] = useState(false)
    const [logoutLoading, setLogoutLoading] = useState(false)
    const [sessionCount, setSessionCount] = useState<number>(0)

    // Issue Reporting State
    const [issueCategory, setIssueCategory] = useState("")
    const [issueDescription, setIssueDescription] = useState("")
    const [submittingIssue, setSubmittingIssue] = useState(false)
    const [myIssues, setMyIssues] = useState<AssetIssue[]>([])

    // AI Config State
    const [aiApiKey, setAiApiKey] = useState<string>("")
    const [existingAiKey, setExistingAiKey] = useState<string | null>(null)
    const [updatingAiKey, setUpdatingAiKey] = useState(false)
    const [showAiApiKey, setShowAiApiKey] = useState(false)

    // MongoDB Sync State
    const [mongoDbUri, setMongoDbUri] = useState<string>("")
    const [existingMongoUri, setExistingMongoUri] = useState<string | null>(null)
    const [updatingMongoUri, setUpdatingMongoUri] = useState(false)
    const [showMongoUri, setShowMongoUri] = useState(false)
    const [syncingMongo, setSyncingMongo] = useState(false)
    const [syncLogs, setSyncLogs] = useState<any[]>([])

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToActiveSessions(user.uid, (count) => {
            setSessionCount(count);
        });
        
        const unsubscribeIssues = assetIssueService.subscribeToEmployeeIssues(user.uid, (issues) => {
            setMyIssues(issues);
        });

        let unsubscribeAi: (() => void) | undefined;
        let unsubscribeMongo: (() => void) | undefined;
        let unsubscribeLogs: (() => void) | undefined;

        if (role === 'admin') {
            unsubscribeAi = settingsService.subscribeToAiApiKey((key) => {
                setExistingAiKey(key);
                setAiApiKey(key || "");
            });
            unsubscribeMongo = settingsService.subscribeToMongoDbUri((uri) => {
                setExistingMongoUri(uri);
                setMongoDbUri(uri || "");
            });
            unsubscribeLogs = settingsService.subscribeToMongoDbSyncLogs((logs) => {
                setSyncLogs(logs);
            });
        }

        return () => {
            unsubscribe();
            unsubscribeIssues();
            if (unsubscribeAi) unsubscribeAi();
            if (unsubscribeMongo) unsubscribeMongo();
            if (unsubscribeLogs) unsubscribeLogs();
        };
    }, [user, role]);

    const handleReportIssue = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !issueCategory || !issueDescription) return

        setSubmittingIssue(true)
        try {
            await assetIssueService.addIssue({
                employeeName: user.displayName || user.email?.split('@')[0] || "Unknown",
                employeeEmail: user.email || "",
                employeeId: user.uid,
                category: issueCategory,
                description: issueDescription
            })
            toast.success("Issue reported successfully. The networking team will look into it.")
            setIssueCategory("")
            setIssueDescription("")
        } catch (error) {
            console.error(error)
            toast.error("Failed to report issue.")
        } finally {
            setSubmittingIssue(false)
        }
    }

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match.")
            return
        }

        setLoading(true)
        try {
            await updatePassword(user, newPassword)
            toast.success("Password updated successfully. Please sign in again with your new password.")
            setNewPassword("")
            setConfirmPassword("")
            await signOut(auth);
        } catch (error: any) {
            console.error(error)
            if (error.code === 'auth/requires-recent-login') {
                toast.error("Security timeout. Please log out and log back in to change your password.")
            } else {
                toast.error("Failed to update password. " + (error.message || ""))
            }
        } finally {
            setLoading(false)
        }
    };

    const handleToggleMFA = async (enabled: boolean) => {
        setMfaLoading(true);
        try {
            const toggleFn = httpsCallable(functions, 'toggleTwoFactor');
            await toggleFn({ enabled });
            
            if (enabled) {
                await signOut(auth);
                toast.success("Two-factor authentication enabled. Please sign in again to verify.");
            } else {
                await refreshRole();
                toast.success("Two-factor authentication disabled.");
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to update security settings.");
        } finally {
            setMfaLoading(false);
        }
    };

    const handleLogoutAll = async () => {
        setLogoutLoading(true);
        try {
            const logoutFn = httpsCallable(functions, 'logoutAllDevices');
            await logoutFn();
            toast.success("Successfully logged out from all devices.");
            window.location.reload(); 
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to revoke sessions.");
        } finally {
            setLogoutLoading(false);
        }
    };

    const handleSaveAiApiKey = async () => {
        if (!aiApiKey.trim()) return
        setUpdatingAiKey(true)
        try {
            await settingsService.updateAiApiKey(aiApiKey.trim())
            toast.success("AI API Key updated successfully.")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update AI API Key.")
        } finally {
            setUpdatingAiKey(false)
        }
    }

    const handleDeleteAiApiKey = async () => {
        setUpdatingAiKey(true)
        try {
            await settingsService.deleteAiApiKey()
            setAiApiKey("")
            toast.success("AI API Key deleted.")
        } catch (error) {
            console.error(error)
            toast.error("Failed to delete AI API Key.")
        } finally {
            setUpdatingAiKey(false)
        }
    }

    const handleSaveMongoUri = async () => {
        if (!mongoDbUri.trim()) return
        setUpdatingMongoUri(true)
        try {
            await settingsService.updateMongoDbUri(mongoDbUri.trim())
            toast.success("MongoDB Connection URI updated successfully.")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update MongoDB Connection URI.")
        } finally {
            setUpdatingMongoUri(false)
        }
    }

    const handleDeleteMongoUri = async () => {
        setUpdatingMongoUri(true)
        try {
            await settingsService.deleteMongoDbUri()
            setMongoDbUri("")
            toast.success("MongoDB Connection URI deleted.")
        } catch (error) {
            console.error(error)
            toast.error("Failed to delete MongoDB Connection URI.")
        } finally {
            setUpdatingMongoUri(false)
        }
    }

    const handleManualMongoSync = async () => {
        setSyncingMongo(true)
        const syncToast = toast.loading("Syncing all modules to MongoDB...")
        try {
            const syncFn = httpsCallable(functions, 'manualMongoDBSync');
            const result: any = await syncFn();
            
            if (result.data?.success) {
                toast.success("MongoDB Data Seeding/Sync complete!", { id: syncToast })
                
                // Show a detailed summary of what was synced
                const collections = result.data?.syncedCollections || {};
                const summary = Object.entries(collections)
                    .map(([col, count]) => `${col}: ${count} docs`)
                    .join(", ");
                toast.info(`Synced successfully: ${summary}`);
            } else {
                toast.error("Failed to seed/sync MongoDB data.", { id: syncToast })
            }
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Failed to trigger MongoDB sync.", { id: syncToast })
        } finally {
            setSyncingMongo(false)
        }
    }

    return (
        <div className="ml-0 w-full lg:w-1/2 py-12 px-6 animate-in fade-in duration-700">
            <div className="space-y-0.5 mb-10">
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account settings and set e-mail preferences.
                </p>
            </div>

            <Tabs defaultValue="account" className="space-y-8">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 gap-6 h-auto">
                    <TabsTrigger 
                        value="account" 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground transition-none"
                    >
                        Account
                    </TabsTrigger>
                    <TabsTrigger 
                        value="security" 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground transition-none"
                    >
                        Security
                    </TabsTrigger>
                    <TabsTrigger 
                        value="support" 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground transition-none text-red-500 data-[state=active]:text-red-600"
                    >
                        IT Support
                    </TabsTrigger>
                    {role === 'admin' && (
                        <TabsTrigger 
                            value="admin" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground transition-none text-blue-500 data-[state=active]:text-blue-600"
                        >
                            Admin
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="account" className="space-y-10 focus-visible:outline-none">
                    <section className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={user?.photoURL || ""} />
                                <AvatarFallback className="bg-muted text-lg font-semibold">
                                    {user?.email?.[0].toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                                <h3 className="text-lg font-medium leading-none">{user?.displayName || 'Member'}</h3>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="capitalize font-normal text-xs bg-muted/30">
                                        {role || 'user'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-6">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground font-normal">Email</Label>
                                <p className="text-sm font-medium">{user?.email}</p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold">Verified Sessions</h3>
                            <p className="text-sm text-muted-foreground">Manage your active presence across devices.</p>
                        </div>
                        
                        <div className="rounded-lg border p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Monitor className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Logged in on {sessionCount} {sessionCount === 1 ? 'device' : 'devices'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-tight">This Device</span>
                                </div>
                            </div>
                            
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button 
                                        variant="destructive" 
                                        size="sm"
                                        className="w-full sm:w-auto h-9"
                                        disabled={logoutLoading}
                                    >
                                        {logoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Sign out of all other sessions
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will log you out from all devices, including this one. You will need to sign in again on all your devices.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                            onClick={handleLogoutAll}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Sign out all devices
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </section>
                </TabsContent>

                <TabsContent value="security" className="space-y-10 focus-visible:outline-none">
                    <section className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold">Two-factor authentication</h3>
                            <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Email verification</Label>
                                <p className="text-xs text-muted-foreground">
                                    {role === 'admin' ? "Requirement enforced for admins." : "Receive a code via email when signing in."}
                                </p>
                            </div>
                            <Switch 
                                checked={mfaEnabled} 
                                onCheckedChange={handleToggleMFA}
                                disabled={mfaLoading || role === 'admin'}
                            />
                        </div>

                        <div className="rounded-lg bg-muted/40 p-4 flex gap-3">
                            <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="text-[12px] text-muted-foreground leading-relaxed italic">
                                Multi-factor authentication helps protect your account from unauthorized access by requiring a separate confirmation step.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold">Change password</h3>
                            <p className="text-sm text-muted-foreground">Update your password to keep your account secure.</p>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-sm">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New password</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-background"
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm new password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-background"
                                    minLength={6}
                                    required
                                />
                            </div>
                            <Button 
                                type="submit"
                                className="w-full sm:w-auto"
                                disabled={loading || !newPassword}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update password
                            </Button>
                        </form>
                    </section>
                </TabsContent>

                <TabsContent value="support" className="space-y-10 focus-visible:outline-none">
                    <section className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold text-red-600 flex items-center gap-2">
                                <Wrench className="h-4 w-4" />
                                Report System Issue
                            </h3>
                            <p className="text-sm text-muted-foreground">Is your system running slow or having hardware issues? Report it here.</p>
                        </div>

                        <form onSubmit={handleReportIssue} className="space-y-4 max-w-md bg-red-50/30 p-6 rounded-2xl border border-red-100">
                            <div className="space-y-2">
                                <Label htmlFor="category">Issue Category</Label>
                                <Select value={issueCategory} onValueChange={setIssueCategory} required>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Select type of issue" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Hanging issue">Hanging issue</SelectItem>
                                        <SelectItem value="Slow">Slow performance</SelectItem>
                                        <SelectItem value="Software not running">Software not running</SelectItem>
                                        <SelectItem value="Mouse issue">Mouse issue</SelectItem>
                                        <SelectItem value="Keyboard issue">Keyboard issue</SelectItem>
                                        <SelectItem value="Display issue">Display issue</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="issue-description">Description</Label>
                                <textarea
                                    id="issue-description"
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Describe the problem in detail..."
                                    value={issueDescription}
                                    onChange={(e) => setIssueDescription(e.target.value)}
                                    required
                                />
                            </div>
                            <Button 
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                                disabled={submittingIssue || !issueCategory || !issueDescription}
                            >
                                {submittingIssue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Submit Report
                            </Button>
                        </form>
                    </section>

                    <Separator />

                    <section className="space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold">My Reported Issues</h3>
                            <p className="text-sm text-muted-foreground">Track the status of your reported system problems.</p>
                        </div>

                        <div className="space-y-3">
                            {myIssues.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">You haven't reported any issues yet.</p>
                            ) : (
                                myIssues.map((issue) => (
                                    <div key={issue.id} className="flex items-start justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-all">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold uppercase tracking-tight text-slate-900">{issue.category}</span>
                                                <Badge variant={issue.status === 'Fixed' ? 'default' : 'secondary'} className={issue.status === 'Fixed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}>
                                                    {issue.status === 'Fixed' ? (
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" /> Fixed
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" /> Pending
                                                        </span>
                                                    )}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{issue.description}</p>
                                            <p className="text-[10px] text-slate-400">
                                                Reported on: {issue.createdAt?.seconds ? new Date(issue.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </TabsContent>

                {role === 'admin' && (
                    <TabsContent value="admin" className="space-y-10 focus-visible:outline-none">
                        <section className="space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold text-blue-600 flex items-center gap-2">
                                    <Monitor className="h-4 w-4" />
                                    Global AI Configuration
                                </h3>
                                <p className="text-sm text-muted-foreground">Manage the API keys used for AI features across the platform.</p>
                            </div>

                            <div className="rounded-lg border p-6 space-y-6 bg-blue-50/10 border-blue-100">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="ai-api-key" className="text-blue-900 font-bold">Google Gemini API Key</Label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Input
                                                    id="ai-api-key"
                                                    type={showAiApiKey ? "text" : "password"}
                                                    placeholder="Enter API Key"
                                                    value={aiApiKey}
                                                    onChange={(e) => setAiApiKey(e.target.value)}
                                                    className="bg-white border-blue-200 focus-visible:ring-blue-500 pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAiApiKey(!showAiApiKey)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-blue-600 transition-colors"
                                                >
                                                    {showAiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <Button 
                                                onClick={handleSaveAiApiKey} 
                                                disabled={updatingAiKey || !aiApiKey.trim() || aiApiKey === existingAiKey}
                                                className="bg-blue-600 hover:bg-blue-700"
                                            >
                                                {updatingAiKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                            </Button>
                                            {existingAiKey && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={updatingAiKey}>
                                                            Delete
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will remove the global AI API key. AI features may stop working until a new key is provided.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleDeleteAiApiKey} className="bg-red-600 hover:bg-red-700">
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground italic">
                                            This key is stored securely in Firestore and used for all Gemini AI requests.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <Separator className="my-8" />

                        <section className="space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold text-emerald-600 flex items-center gap-2">
                                    <Database className="h-4 w-4" />
                                    MongoDB Backup & Sync Configuration
                                </h3>
                                <p className="text-sm text-muted-foreground">Configure manual or automated daily database backups to MongoDB.</p>
                            </div>

                            <div className="rounded-lg border p-6 space-y-6 bg-emerald-50/10 border-emerald-100">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="mongodb-uri" className="text-emerald-900 font-bold">MongoDB Connection URI</Label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Input
                                                    id="mongodb-uri"
                                                    type={showMongoUri ? "text" : "password"}
                                                    placeholder="mongodb+srv://username:password@cluster.mongodb.net/uxdcrm"
                                                    value={mongoDbUri}
                                                    onChange={(e) => setMongoDbUri(e.target.value)}
                                                    className="bg-white border-emerald-200 focus-visible:ring-emerald-500 pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMongoUri(!showMongoUri)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-emerald-600 transition-colors"
                                                >
                                                    {showMongoUri ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <Button 
                                                onClick={handleSaveMongoUri} 
                                                disabled={updatingMongoUri || !mongoDbUri.trim() || mongoDbUri === existingMongoUri}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            >
                                                {updatingMongoUri ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                            </Button>
                                            {existingMongoUri && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={updatingMongoUri}>
                                                            Delete
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will remove the saved MongoDB Connection URI. Automated daily backups and manual seeding will be disabled.
                                                             </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleDeleteMongoUri} className="bg-red-600 hover:bg-red-700 text-white">
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground italic">
                                            Credentials are encrypted and saved securely inside your Firestore Settings database.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <Separator className="my-8" />

                        <section className="space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-base font-semibold flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4 text-slate-700" />
                                    Manual Seeding & Backup Sync
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Instantly trigger a manual seed/sync of all Firestore active modules to your MongoDB database backup.
                                </p>
                            </div>

                            <div className="rounded-2xl border p-6 bg-slate-50/50 border-slate-200/60 space-y-6">
                                <div className="space-y-2 text-sm text-slate-600">
                                    <p className="font-semibold text-slate-800">Collections Included in Backup:</p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {['users', 'employees', 'clients', 'projects', 'blogs', 'leads', 'invoices', 'settings', 'assets', 'assetIssues', 'apps', 'emailSignatures', 'emailTemplates', 'appLinks', 'backlinks'].map((col) => (
                                            <Badge key={col} variant="outline" className="bg-white/80 font-normal px-2.5 py-0.5 border-slate-200 capitalize text-slate-700">
                                                {col}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <Button
                                    onClick={handleManualMongoSync}
                                    disabled={syncingMongo || !existingMongoUri}
                                    className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white shadow-sm flex items-center justify-center gap-2"
                                >
                                    {syncingMongo ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4" />
                                    )}
                                    Sync/Seed Data to MongoDB Now
                                </Button>
                                
                                {!existingMongoUri && (
                                    <p className="text-xs text-red-500 italic mt-2">
                                        * Please enter and save a valid MongoDB Connection URI above to enable backups.
                                    </p>
                                )}
                            </div>
                        </section>

                        <Separator className="my-8" />

                        <section className="space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold">MongoDB Backup Log History</h3>
                                <p className="text-sm text-muted-foreground">Track recent backup actions and document sync sizes.</p>
                            </div>

                            <div className="space-y-3">
                                {syncLogs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No sync operations have run or been logged yet.</p>
                                ) : (
                                    syncLogs.map((log) => (
                                        <div key={log.id} className="flex items-start justify-between p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all text-sm">
                                            <div className="space-y-2 w-full">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-800">
                                                            {log.status === 'success' ? 'Backup Completed' : 'Backup Failed'}
                                                        </span>
                                                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className={log.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                                            {log.status === 'success' ? 'Success' : 'Failed'}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-xs text-slate-400">
                                                        {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Just now'}
                                                    </span>
                                                </div>
                                                {log.status === 'success' && log.syncedCollections && (
                                                    <div className="bg-slate-50/50 rounded-lg p-3 text-xs text-slate-600 border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                        {Object.entries(log.syncedCollections).map(([colName, count]: [string, any]) => (
                                                            <div key={colName} className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                <span className="capitalize text-slate-500">{colName}:</span>
                                                                <span className="font-semibold text-slate-700">{count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {log.status === 'failed' && log.error && (
                                                    <p className="text-xs text-red-600 bg-red-50/40 p-2.5 rounded-lg border border-red-100/50 font-mono">
                                                        Error: {log.error}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}
