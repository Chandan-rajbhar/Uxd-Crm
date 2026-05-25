import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ThumbsDown, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface ProjectModalsProps {
    // Clear all
    isClearAllOpen: boolean;
    setIsClearAllOpen: (b: boolean) => void;
    onClearAll: () => void;
    // Delete task
    isDeleteOpen: boolean;
    setIsDeleteOpen: (b: boolean) => void;
    onConfirmDelete: () => void;
    // Client action
    actionType: 'reject' | 'doubt' | 'view-reject' | 'view-doubt' | null;
    setActionType: (t: 'reject' | 'doubt' | 'view-reject' | 'view-doubt' | null) => void;
    actionTask: any;
    actionReason: string;
    setActionReason: (s: string) => void;
    onSubmitClientAction: () => void;
}

export function ProjectModals({
    isClearAllOpen, setIsClearAllOpen, onClearAll,
    isDeleteOpen, setIsDeleteOpen, onConfirmDelete,
    actionType, setActionType, actionTask, actionReason, setActionReason, onSubmitClientAction
}: ProjectModalsProps) {
    return (
        <>
            <AlertDialog open={isClearAllOpen} onOpenChange={setIsClearAllOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear All Tasks?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all tasks in this project. This action cannot be undone. Are you sure you want to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onClearAll} className="bg-red-600 hover:bg-red-700">
                            Clear All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the task and remove it from the timeline.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onConfirmDelete} className="bg-red-600 hover:bg-red-700">
                            Delete Task
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
                <DialogContent className="sm:max-w-[500px] rounded-2xl overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="space-y-3 pb-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                                actionType?.includes('reject') ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                            )}>
                                {actionType?.includes('reject') ? <ThumbsDown className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold">
                                    {actionType === 'reject' ? 'Reject Task' :
                                        actionType === 'view-reject' ? 'Rejection Reason' :
                                            actionType === 'doubt' ? 'Share Doubt' : 'Feedback Sent'}
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium">
                                    Task: <span className="text-foreground font-bold">"{actionTask?.task}"</span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2.5">
                            <Label htmlFor="reason" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">
                                {actionType?.includes('reject') ? 'Reasons for Rejection' : 'Questions / Doubts'}
                            </Label>
                            <Textarea
                                id="reason"
                                value={actionReason}
                                onChange={(e) => setActionReason(e.target.value)}
                                placeholder={actionType === 'reject' ? "Please explain what needs to be changed..." : "What's on your mind?"}
                                className={cn(
                                    "min-h-[120px] resize-none rounded-xl border-slate-200 focus-visible:ring-primary leading-relaxed text-sm",
                                    actionType?.startsWith('view-') && "bg-slate-50/50 cursor-default"
                                )}
                                readOnly={actionType?.startsWith('view-')}
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setActionType(null)} className="font-bold rounded-xl mr-auto text-slate-500">
                            {actionType?.startsWith('view-') ? 'Close' : 'Cancel'}
                        </Button>
                        {!actionType?.startsWith('view-') && (
                            <Button
                                onClick={onSubmitClientAction}
                                disabled={!actionReason.trim()}
                                className={cn(
                                    "font-bold rounded-xl px-8",
                                    actionType === 'reject' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-primary text-primary-foreground"
                                )}
                            >
                                {actionType === 'reject' ? 'Confirm Rejection' : 'Send Feedback'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
