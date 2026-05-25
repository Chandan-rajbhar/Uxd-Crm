import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { useState, useEffect } from "react"
import { collection, query, orderBy, getDocs } from "firebase/firestore"
import { db } from "src/firebase/config"
import { format } from "date-fns"
import { Calendar, MessageSquare, Loader2 } from "lucide-react"

interface CommentHistorySheetProps {
    projectId: string
    projectName: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CommentHistorySheet({ projectId, projectName, open, onOpenChange }: CommentHistorySheetProps) {
    const [comments, setComments] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const fetchHistory = async () => {
            if (open && projectId) {
                setIsLoading(true)
                try {
                    const q = query(
                        collection(db, "projects", projectId, "trackerComments"),
                        orderBy("createdAt", "desc")
                    )
                    const snapshot = await getDocs(q)
                    const history = snapshot.docs.map((doc: any) => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    setComments(history)
                } catch (error) {
                    console.error("Failed to fetch comment history:", error)
                } finally {
                    setIsLoading(false)
                }
            }
        }
        fetchHistory()
    }, [open, projectId])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[400px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle>Comment History</SheetTitle>
                    <SheetDescription>
                        Past admin comments for <strong>{projectName}</strong>.
                    </SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-50">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-xs font-medium uppercase tracking-widest">Loading History...</p>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
                        <MessageSquare className="h-10 w-10 opacity-20" />
                        <p>No past comments found.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {comments.map((c) => (
                            <div key={c.id} className="relative pl-6 border-l-2 border-muted pb-2 last:pb-0">
                                <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-white border-2 border-primary flex items-center justify-center">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        <Calendar className="h-3 w-3 mr-1.5" />
                                        {c.date ? (c.date.includes('-') ? format(new Date(c.date), 'MMMM d, yyyy') : c.date) : 'Unknown Date'}
                                    </div>
                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border border-muted/50">
                                        {c.comment}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
