import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Mail,
    Phone,
    Briefcase,
    Building2,
    Calendar,
    ExternalLink,
    Sparkles,
    Search,
    Brain,
    Globe,
    ExternalLinkIcon
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { clientService } from "src/firebase/clientService"
import { toast } from "sonner"

interface ClientDetailsSheetProps {
    client: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ClientDetailsSheet({ client, open, onOpenChange }: ClientDetailsSheetProps) {
    const [isResearching, setIsResearching] = useState(false)
    const [intelData, setIntelData] = useState<{ intelligence?: string, sources?: any[], images?: any[] } | null>(null)

    useEffect(() => {
        if (open && client?.id) {
            // First check legacy top-level data, then query subcollection
            if (client.intelligence) {
                setIntelData({
                    intelligence: client.intelligence,
                    sources: client.intelligenceSources,
                    images: client.intelligenceImages
                })
            }
            clientService.getIntelligence(client.id).then((data) => {
                if (data) {
                    setIntelData({
                        intelligence: data.intelligence,
                        sources: data.intelligenceSources,
                        images: data.intelligenceImages
                    })
                }
            })
        } else {
            setIntelData(null)
        }
    }, [open, client])

    if (!client) return null

    const handleResearch = async () => {
        if (!client.name || !client.company) {
            toast.error("Need both name and company to perform research.")
            return
        }

        setIsResearching(true)
        try {
            const result = await clientService.researchClient(client.name, client.company)

            if (result.success) {
                // Save to Subcollection instead of bloating the main client doc
                await clientService.updateIntelligence(client.id, {
                    intelligence: result.intelligence,
                    intelligenceSources: result.sources,
                    intelligenceImages: result.images
                })
                
                setIntelData({
                    intelligence: result.intelligence,
                    sources: result.sources,
                    images: result.images
                })
                toast.success("Intelligence profile generated!")
            }
        } catch (error) {
            console.error("Research failed:", error)
            toast.error("Failed to perform AI research. Please try again.")
        } finally {
            setIsResearching(false)
        }
    }

    // Helper to format the markdown headers into something prettier if needed
    const renderIntelligence = (text: string) => {
        if (!text) return null;

        const sections = text.split("##").filter(Boolean);
        return (
            <div className="space-y-8 pb-10">
                {sections.map((section, idx) => {
                    const lines = section.trim().split("\n");
                    const title = lines[0].replace(/_/g, " ").toUpperCase();
                    const content = lines.slice(1).join("\n").trim();

                    const processContent = (text: string) => {
                        const parts = text.split(/(!\[.*?\]\(.*?\))/g);
                        return parts.map((part, i) => {
                            const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
                            if (imgMatch) {
                                return (
                                    <div key={i} className="my-6 max-w-[300px] rounded-xl overflow-hidden border shadow-lg bg-slate-100 group">
                                        <img
                                            src={imgMatch[2]}
                                            alt={imgMatch[1]}
                                            className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                        {imgMatch[1] && (
                                            <div className="bg-white/80 backdrop-blur-md p-2 text-[10px] font-medium text-slate-500 text-center border-t">
                                                {imgMatch[1]}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return <p key={i} className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{part}</p>;
                        });
                    };

                    return (
                        <div key={idx} className="group overflow-hidden">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <h3 className="text-[11px] font-bold tracking-[0.2em] text-primary/70">{title}</h3>
                            </div>
                            <div className="pl-3 border-l-2 border-primary/5 group-hover:border-primary/20 transition-colors">
                                {processContent(content)}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[45%] overflow-hidden flex flex-col p-0 gap-0">
                {/* Header */}
                <div className="h-32 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent relative border-b flex-shrink-0">
                    <div className="absolute -bottom-10 left-8">
                        <Avatar className="h-20 w-20 border-4 border-background rounded-2xl shadow-xl bg-background">
                            <AvatarFallback className="text-2xl rounded-2xl bg-primary/10 text-primary font-bold">
                                {client.name ? client.name[0] : "C"}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </div>

                <div className="px-8 pt-14 pb-4 space-y-6 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight">{client.name}</h2>
                            <p className="text-muted-foreground flex items-center gap-2 font-medium">
                                <Building2 className="h-4 w-4" />
                                {client.company}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge variant={client.status === "Active" ? "default" : "secondary"} className="rounded-full px-3 py-1 shadow-sm">
                                {client.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                {client.industry}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/50">
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                            <div className="p-2 rounded-full bg-primary/10 text-primary">
                                <Mail className="h-4 w-4" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Email</p>
                                <p className="text-sm font-semibold truncate" title={client.email}>{client.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                            <div className="p-2 rounded-full bg-primary/10 text-primary">
                                <Phone className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Phone</p>
                                <p className="text-sm font-semibold">{client.phone || "Not set"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col px-8">
                    <Tabs defaultValue="intelligence" className="w-full flex-1 flex flex-col">
                        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-8 flex-shrink-0">
                            <TabsTrigger value="projects" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-0 py-3 text-sm font-bold transition-all">PROJECTS</TabsTrigger>
                            <TabsTrigger value="intelligence" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-0 py-3 text-sm font-bold transition-all flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5" />
                                INTELLIGENCE
                            </TabsTrigger>
                            <TabsTrigger value="history" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-0 py-3 text-sm font-bold transition-all">HISTORY</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-hidden relative">
                            <TabsContent value="projects" className="absolute inset-0 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-y-auto no-scrollbar">
                                {client.projects && client.projects.length > 0 ? (
                                    <div className="grid gap-3 pb-8">
                                        {client.projects.map((project: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-muted/30 transition-all hover:shadow-sm border-border/60">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-primary/10 rounded-lg shadow-sm">
                                                        <AvatarImage src={project.logo} className="object-cover" />
                                                        <AvatarFallback className="rounded-lg bg-slate-100 text-[10px] font-bold">{project.name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-bold">{project.name}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <Badge variant="outline" className="text-[10px] h-5 py-0 font-medium">
                                                                {project.status}
                                                            </Badge>
                                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                                Due {project.dueDate}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary transition-colors">
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                                        <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p className="text-sm font-medium">No active projects for this client.</p>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="intelligence" className="absolute inset-0 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-y-auto no-scrollbar">
                                {isResearching ? (
                                    <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
                                        <div className="relative">
                                            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                            <div className="relative h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Brain className="h-10 w-10 text-primary animate-pulse" />
                                            </div>
                                            <Globe className="absolute -top-2 -right-2 h-6 w-6 text-blue-500 animate-spin-slow" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-bold">Deep Web Investigation</h3>
                                            <p className="text-sm text-muted-foreground max-w-[280px]">
                                                Searching LinkedIn, industry news, and company reports for insights...
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="animate-pulse">Scraping</Badge>
                                            <Badge variant="outline" className="animate-pulse delay-75">Analyzing</Badge>
                                            <Badge variant="outline" className="animate-pulse delay-150">Synthesizing</Badge>
                                        </div>
                                    </div>
                                ) : intelData?.intelligence ? (
                                    <div className="pb-10">
                                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/40">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                                                    <Brain className="h-4 w-4" />
                                                </div>
                                                <span className="text-xs font-bold text-emerald-800 tracking-wider">AI AGENT REPORT</span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px] font-bold gap-1.5 hover:bg-primary/5 border-primary/20 text-primary"
                                                onClick={handleResearch}
                                            >
                                                <Search className="h-3 w-3" />
                                                REFRESH DATA
                                            </Button>
                                        </div>

                                        {renderIntelligence(intelData.intelligence || "")}

                                        {intelData.sources && intelData.sources.length > 0 && (
                                            <div className="mt-8 pt-6 border-t border-border/40">
                                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Verified Sources</h4>
                                                <div className="grid gap-2">
                                                    {intelData.sources.map((source: any, i: number) => (
                                                        <a
                                                            key={i}
                                                            href={source.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-xs text-blue-600 group transition-all"
                                                        >
                                                            <span className="truncate max-w-[400px] flex items-center gap-2">
                                                                <Globe className="h-3 w-3 opacity-40" />
                                                                {source.title}
                                                            </span>
                                                            <ExternalLinkIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
                                        <div className="h-24 w-24 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200">
                                            <Search className="h-10 w-10 text-slate-300" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-bold">No Intelligence Data</h3>
                                            <p className="text-sm text-muted-foreground max-w-[320px]">
                                                Unlock deep insights about {client.name} and their role at {client.company} by running an AI-powered web investigation.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleResearch}
                                            className="px-8 py-6 rounded-2xl bg-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all gap-2 group"
                                        >
                                            <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                                            Investigate with AI
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="history" className="absolute inset-0 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-y-auto no-scrollbar">
                                <div className="text-center py-12 text-muted-foreground">
                                    <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">Client history log coming soon.</p>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    )
}
