import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { format } from "date-fns"
import { Switch } from "@/components/ui/switch"
import { projectService } from "src/firebase/projectService"

interface TemplateTasksSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    project: any
    onTasksAdded?: () => void
    targetMonth?: string
}

export function TemplateTasksSheet({ open, onOpenChange, project, onTasksAdded, targetMonth }: TemplateTasksSheetProps) {
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Instagram', 'Facebook'])
    const [postsPerWeek, setPostsPerWeek] = useState<number>(4)
    const [reelsPerWeek, setReelsPerWeek] = useState<number>(1)
    const [videosPerWeek, setVideosPerWeek] = useState<number>(1)
    const [blogsPerWeek, setBlogsPerWeek] = useState<number>(1)
    const [weeksCount] = useState<number>(4)
    const [emailPerWeek, setEmailPerWeek] = useState<number>(0)
    const [backlinks, setBacklinks] = useState<boolean>(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [selectedMonths, setSelectedMonths] = useState<string[]>([])

    useEffect(() => {
        if (open) {
            setSelectedMonths([targetMonth || format(new Date(), 'MMMM yyyy')])
        }
    }, [open, targetMonth])

    const upcomingMonths = useMemo(() => {
        const months: string[] = []
        for(let i=0; i<6; i++) {
           const d = new Date()
           d.setMonth(d.getMonth() + i)
           months.push(format(d, 'MMMM yyyy'))
        }
        return months
    }, [])



    const handleGenerate = async () => {
        if (!project?.id) return

        setIsGenerating(true)
        try {
            const weeks = weeksCount
            const newTasks: any[] = []

            for (const sm of selectedMonths) {
                for (let week = 0; week < weeks; week++) {


                    // Generate Social Media Posts
                    for (let i = 0; i < postsPerWeek; i++) {
                        if (selectedPlatforms.length === 0) {
                            newTasks.push(createTask(`Social Media Post ${i + 1}`, `Week ${week + 1}`, sm, 'Post', ''))
                        } else {
                            // Separate task for each platform (Single Select Model)
                            selectedPlatforms.forEach(p => {
                                newTasks.push(createTask(`${p} Post ${i + 1}`, `Week ${week + 1}`, sm, 'Post', p))
                            })
                        }
                    }

                    // Generate Reels
                    for (let i = 0; i < reelsPerWeek; i++) {
                        newTasks.push(createTask(`Reel ${i + 1}`, `Week ${week + 1}`, sm, 'Reel', 'Instagram'))
                    }

                    // Generate Youtube Videos
                    for (let i = 0; i < videosPerWeek; i++) {
                        newTasks.push(createTask(`YouTube Video ${i + 1}`, `Week ${week + 1}`, sm, 'Video', 'YouTube'))
                    }

                    // Generate Blogs
                    for (let i = 0; i < blogsPerWeek; i++) {
                        newTasks.push(createTask(`Blog Post ${i + 1}`, `Week ${week + 1}`, sm, 'Blog'))
                    }

                    // Generate Email Marketing
                    for (let i = 0; i < emailPerWeek; i++) {
                        newTasks.push(createTask(`Email Marketing ${i + 1}`, `Week ${week + 1}`, sm, 'Blog'))
                    }

                    // Generate Backlinks (One per week if toggled)
                    if (backlinks) {
                        newTasks.push(createTask(`Backlink Outreach`, `Week ${week + 1}`, sm, 'Blog'))
                    }
                }
            }

            const currentMilestones = project.milestones || []
            // According to requirement: leaving existing tasks alone and adding the new ones
            const updatedMilestones = [...currentMilestones, ...newTasks]

            await projectService.updateProject(project.id, {
                milestones: updatedMilestones
            })

            toast.success("Template tasks generated successfully!")
            onOpenChange(false)
            if (onTasksAdded) onTasksAdded()
        } catch (error) {
            console.error("Failed to generate template tasks:", error)
            toast.error("Failed to generate tasks")
        } finally {
            setIsGenerating(false)
        }
    }

    const createTask = (taskName: string, weekLabel: string, currentTargetMonth: string, contentType: string = 'Post', targetPlatform: string = '') => {
        return {
            id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            task: taskName,
            week: weekLabel,
            monthYear: currentTargetMonth,
            date: '',
            actualPostingDate: '',
            status: 'Pending',
            contentType: contentType,
            platform: targetPlatform,
            description: 'Generated from Template Project Plan',
            isPrebuilt: true,
            assignedTo: [],
            notes: [],
            attachments: [],
            subtasks: []
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-[600px]">
                <SheetHeader>
                    <SheetTitle>Digital Marketing Template Tasks</SheetTitle>
                    <SheetDescription>
                        Generate tasks for your digital marketing project.
                    </SheetDescription>
                </SheetHeader>

                <div className="grid gap-6 py-6 border-b border-t mt-6 border-slate-100">
                    <div className="grid gap-3 mb-2">
                        <Label className="font-bold text-primary">Target Months</Label>
                        <div className="flex flex-wrap gap-2">
                            {upcomingMonths.map(month => (
                                <button
                                    key={month}
                                    onClick={() => setSelectedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month])}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${selectedMonths.includes(month) ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-white'}`}
                                >
                                    {month}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3 mb-2">
                        <Label className="font-bold text-primary">Target Platforms (For Posts)</Label>
                        <div className="flex flex-wrap gap-2">
                            {['Instagram', 'Facebook', 'LinkedIn', 'Twitter/X', 'YouTube', 'TikTok', 'Pinterest'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${selectedPlatforms.includes(p) ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-white'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <Label>Social Media Posts (Per Week)</Label>
                        <Input
                            type="number"
                            min="0"
                            value={postsPerWeek}
                            onChange={(e) => setPostsPerWeek(parseInt(e.target.value) || 0)}
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label>Reels (Per Week)</Label>
                        <Input
                            type="number"
                            min="0"
                            value={reelsPerWeek}
                            onChange={(e) => setReelsPerWeek(parseInt(e.target.value) || 0)}
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label>YouTube Videos (Per Week)</Label>
                        <Input
                            type="number"
                            min="0"
                            value={videosPerWeek}
                            onChange={(e) => setVideosPerWeek(parseInt(e.target.value) || 0)}
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label>Blogs (Per Week)</Label>
                        <Input
                            type="number"
                            min="0"
                            value={blogsPerWeek}
                            onChange={(e) => setBlogsPerWeek(parseInt(e.target.value) || 0)}
                        />
                    </div>

                    <div className="grid gap-3">
                        <Label>Email Marketing (Per Week)</Label>
                        <Input
                            type="number"
                            min="0"
                            value={emailPerWeek}
                            onChange={(e) => setEmailPerWeek(parseInt(e.target.value) || 0)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label className="cursor-pointer" htmlFor="backlinks">Backlinks</Label>
                        <Switch 
                            id="backlinks" 
                            checked={backlinks} 
                            onCheckedChange={setBacklinks} 
                        />
                    </div>
                </div>

                <div className="py-6 pt-6">
                    <Button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || (postsPerWeek === 0 && reelsPerWeek === 0 && videosPerWeek === 0 && blogsPerWeek === 0 && emailPerWeek === 0 && !backlinks) || weeksCount < 1}
                        className="w-full h-12 font-bold"
                    >
                        {isGenerating ? "Generating..." : "Generate Template Tasks"}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}
