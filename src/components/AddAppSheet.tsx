import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"
import { useState } from "react"
import { appsService } from "src/firebase/appsService"

export function AddAppSheet({ trigger }: { trigger?: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        android: "Deployed - Live",
        ios: "Deployed - Live",
        logo: "",
        playStoreLink: "",
        appStoreLink: "",
        rejectionIssue: "",
        developer: "Unassigned",
        status: "In Progress"
    })

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async () => {
        if (!formData.name) return; // Basic validation

        setLoading(true)
        try {
            await appsService.addApp(formData);
            setOpen(false)
            setFormData({
                name: "",
                android: "Deployed - Live",
                ios: "Deployed - Live",
                logo: "",
                playStoreLink: "",
                appStoreLink: "",
                rejectionIssue: "",
                developer: "Unassigned",
                status: "In Progress"
            })
        } catch (error) {
            console.error("Failed to add app:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {trigger ? trigger : (
                    <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Add App
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="overflow-y-auto w-full sm:max-w-[500px] flex flex-col">
                <SheetHeader>
                    <SheetTitle>Add Mobile App</SheetTitle>
                    <SheetDescription>
                        Track a new mobile application's deployment status.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 py-4 grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">App Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. BeeTennis"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="android-status">Android Status</Label>
                        <Select
                            value={formData.android}
                            onValueChange={(val) => handleChange('android', val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Deployed - Live">Deployed - Live</SelectItem>
                                <SelectItem value="Update Deployed - Live">Update Deployed - Live</SelectItem>
                                <SelectItem value="In review">In Review</SelectItem>
                                <SelectItem value="In review - Reject">In Review - Reject</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="ios-status">iOS Status</Label>
                        <Select
                            value={formData.ios}
                            onValueChange={(val) => handleChange('ios', val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Deployed - Live">Deployed - Live</SelectItem>
                                <SelectItem value="Update Deployed - Live">Update Deployed - Live</SelectItem>
                                <SelectItem value="In review">In Review</SelectItem>
                                <SelectItem value="In review - Reject">In Review - Reject</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="logo">Logo URL</Label>
                        <Input
                            id="logo"
                            placeholder="https://..."
                            value={formData.logo}
                            onChange={(e) => handleChange('logo', e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="play-store">Play Store Link</Label>
                        <Input
                            id="play-store"
                            placeholder="https://play.google.com/..."
                            value={formData.playStoreLink}
                            onChange={(e) => handleChange('playStoreLink', e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="app-store">App Store Link</Label>
                        <Input
                            id="app-store"
                            placeholder="https://apps.apple.com/..."
                            value={formData.appStoreLink}
                            onChange={(e) => handleChange('appStoreLink', e.target.value)}
                        />
                    </div>
                </div>

                <SheetFooter>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "Saving..." : "Save App"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
