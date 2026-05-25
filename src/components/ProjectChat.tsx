import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Loader2 } from "lucide-react"
import { projectService } from "src/firebase/projectService"
import { useAppDispatch, useAppSelector } from "src/store/hooks"
import { setMessages, setActiveProject } from "src/store/slices/projectChatSlice"
import type { Message } from "src/store/slices/projectChatSlice"

interface ProjectChatProps {
    projectId: string
}

export function ProjectChat({ projectId }: ProjectChatProps) {
    const dispatch = useAppDispatch()
    const { messages, loading } = useAppSelector(state => state.projectChat)
    const [newMessage, setNewMessage] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)

    // Mock current user - ideally replace with actual auth
    const currentUser = {
        id: "admin-user",
        name: "You",
        avatar: ""
    }

    useEffect(() => {
        dispatch(setActiveProject(projectId))

        const unsubscribe = projectService.subscribeToProjectMessages(projectId, (msgs) => {
            dispatch(setMessages(msgs as Message[]))

            // Scroll to bottom
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: "smooth" })
            }, 100)
        })
        return () => unsubscribe()
    }, [projectId, dispatch])

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim()) return

        try {
            await projectService.sendProjectMessage(projectId, {
                text: newMessage,
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderAvatar: currentUser.avatar
            })
            setNewMessage("")
        } catch (error) {
            console.error("Failed to send message", error)
        }
    }

    return (
        <div className="flex flex-col h-[500px] border rounded-xl bg-card/50 overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">Project Discussion</h3>
                    <p className="text-xs text-muted-foreground">Team chat and updates</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-background/50 to-background/50">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
                        <div className="p-3 rounded-full bg-muted">
                            <Send className="h-5 w-5" />
                        </div>
                        <p className="text-sm">No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === currentUser.id
                        return (
                            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                <Avatar className="h-8 w-8 mt-1 border border-border">
                                    <AvatarImage src={msg.senderAvatar} />
                                    <AvatarFallback className="text-xs">{msg.senderName[0]}</AvatarFallback>
                                </Avatar>
                                <div className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-muted-foreground">{msg.senderName}</span>
                                        {msg.createdAt && (
                                            <span className="text-[10px] text-muted-foreground/50">
                                                {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        className={`px-4 py-2 rounded-2xl text-sm ${isMe
                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                            : "bg-muted rounded-tl-none border border-border/50"
                                            }`}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 rounded-full bg-muted/50 border-transparent focus:border-primary focus:ring-0 focus:bg-background transition-all"
                    />
                    <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0" disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    )
}
