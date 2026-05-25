import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
    LayoutDashboard,
    FolderKanban,
    Target,
    Sparkles,
    MoreHorizontal,
    Users,
    Video,
    UserCog,
    FileText,
    Monitor,
    BookOpen,
    Settings,
    ClipboardList,
    LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "src/contexts/AuthContext"
import { useEmployees } from "src/hooks/useEmployees"
import { signOut } from "firebase/auth"
import { auth } from "src/firebase/config"
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

export function MobileNav() {
    const location = useLocation()
    const navigate = useNavigate()
    const { isAdmin, role, user } = useAuth()
    const { employees } = useEmployees()
    const [isOpen, setIsOpen] = useState(false)

    const currentPath = location.pathname

    const currentEmployee = !isAdmin ? employees.find(e =>
        e.authUid === user?.uid ||
        (e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase())
    ) : null;

    const handleLogout = async () => {
        try {
            await signOut(auth)
            navigate("/login")
        } catch (error) {
            console.error("Error signing out:", error)
        }
    }

    // Permissions check logic (similar to AppSidebar)
    const hasAccess = (itemTitle: string) => {
        if (isAdmin) return true;
        if (role === 'client') return itemTitle === "Home" || itemTitle === "Projects";

        const dept = currentEmployee?.department?.toLowerCase().trim() || "";
        const team = currentEmployee?.team?.toLowerCase().trim() || "";
        const isLeadMember = dept === "email marketing" || dept === "bde";

        if (itemTitle === "Projects" || itemTitle === "Daily Updates") {
            return !isLeadMember;
        }

        if (itemTitle === "Blogs") {
            const checkDM = (val?: string) => {
                if (!val) return false;
                const n = val.trim().toLowerCase().replace(/\s+/g, '');
                return n === 'dm' || n === 'digitalmarketing';
            }
            return checkDM(team) || checkDM(dept);
        }

        if (itemTitle === "Meetings") {
            const checkBD = (val?: string) => val?.trim().toLowerCase() === 'bde';
            const checkDM = (val?: string) => {
                if (!val) return false;
                const n = val.trim().toLowerCase().replace(/\s+/g, '');
                return n === 'dm' || n === 'digitalmarketing';
            }
            return checkBD(team) || checkBD(dept) || checkDM(team) || checkDM(dept);
        }

        if (itemTitle === "Leads") {
            return dept === "email marketing" || dept === "bde";
        }

        if (itemTitle === "IT Assets") {
            const checkNetworking = (val?: string) => {
                if (!val) return false;
                const n = val.trim().toLowerCase();
                return n.includes('network') || n.includes('it') || n.includes('infrastructure');
            }
            return checkNetworking(team) || checkNetworking(dept);
        }

        if (itemTitle === "Employees") {
            const checkHR = (val?: string) => {
                if (!val) return false;
                const n = val.trim().toLowerCase();
                return /\bhr\b/.test(n) || n.includes('human') || n.includes('recruitment');
            }
            return checkHR(team) || checkHR(dept);
        }

        return true;
    }

    const mainNavItems = [
        { title: "Home", url: "/", icon: LayoutDashboard },
        { title: "Projects", url: "/projects", icon: FolderKanban },
        { 
            title: "Leads", 
            url: isAdmin ? "/leads" : `/leads/${currentEmployee?.id}`, 
            icon: Target 
        },
        { title: "Updates", url: "/daily-updates", icon: Sparkles },
    ].filter(item => hasAccess(item.title === "Updates" ? "Daily Updates" : item.title))

    const moreItems = [
        { title: "Clients", url: "/clients", icon: Users },
        { title: "Meetings", url: "/meetings", icon: Video },
        { title: "Employees", url: "/employees", icon: UserCog },
        { title: "Invoices", url: "/invoices", icon: FileText },
        { title: "IT Assets", url: "/assets", icon: Monitor },
        { title: "Project Tracker", url: "/tasks", icon: ClipboardList },
        { title: "Blogs", url: "/tools/blogs", icon: BookOpen },
        { title: "Settings", url: "/settings", icon: Settings },
    ].filter(item => hasAccess(item.title))

    return (
        <div className="md:hidden fixed bottom-6 left-0 right-0 z-[100] px-8 pointer-events-none">
            <nav className={cn(
                "mx-auto max-w-[340px] h-14 bg-white/80 backdrop-blur-md border border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-full flex items-center justify-around px-2 pointer-events-auto relative transition-all duration-300",
                isOpen ? "opacity-0 translate-y-10 scale-95 pointer-events-none" : "opacity-100 translate-y-0 scale-100"
            )}>
                {mainNavItems.map((item) => {
                    const isActive = currentPath === item.url || (item.url !== "/" && currentPath.startsWith(item.url))
                    const Icon = item.icon
                    
                    return (
                        <Link
                            key={item.title}
                            to={item.url}
                            className={cn(
                                "relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors duration-200",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                            <span className="text-[9px] font-semibold tracking-tight leading-none uppercase">
                                {item.title}
                            </span>
                            
                            {/* Simple minimal dot indicator */}
                            {isActive && (
                                <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full animate-in fade-in zoom-in duration-300" />
                            )}
                        </Link>
                    )
                })}

                {/* More Button */}
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <button className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-muted-foreground hover:text-foreground transition-colors group">
                            <MoreHorizontal className="h-5 w-5 transition-transform group-active:scale-90" />
                            <span className="text-[9px] font-semibold tracking-tight leading-none uppercase">More</span>
                        </button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-[2rem] border-t-0 p-0 flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl">
                        <div className="w-10 h-1 bg-muted/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />
                        
                        <div className="flex-1 px-4 py-8 overflow-y-auto">
                            <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                                {moreItems.map((item) => {
                                    const Icon = item.icon
                                    const isActive = currentPath === item.url || (item.url !== "/" && currentPath.startsWith(item.url))
                                    
                                    return (
                                        <Link
                                            key={item.title}
                                            to={item.url}
                                            onClick={() => setIsOpen(false)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90",
                                                isActive ? "text-primary" : "text-muted-foreground"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2 rounded-xl transition-all",
                                                isActive ? "bg-primary/10" : "bg-muted/5 group-hover:bg-muted/10"
                                            )}>
                                                <Icon className="h-4.5 w-4.5" />
                                            </div>
                                            <span className="text-[10px] font-medium tracking-tight text-center leading-none">{item.title}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t shrink-0">
                            <Button 
                                variant="secondary" 
                                size="sm"
                                className="w-full h-9 rounded-xl text-[11px] font-semibold gap-2 active:scale-[0.98] transition-all bg-muted/30"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                Sign Out
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            </nav>
        </div>
    )
}
