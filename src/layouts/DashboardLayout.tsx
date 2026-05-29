import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

import { Outlet } from "react-router-dom"
import { useAuth } from "src/contexts/AuthContext"
import { Badge } from "src/components/ui/badge"
import { ShieldCheck, User, HardHat } from "lucide-react"
import { PageTransition } from "@/components/PageTransition"
import { MobileNav } from "@/components/MobileNav"

export default function DashboardLayout() {
    const { role } = useAuth()




    const getRoleBadge = () => {
        switch (role) {
            case 'admin':
                return (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 px-2 py-0.5">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                    </Badge>
                )
            case 'employee':
                return (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 px-2 py-0.5">
                        <HardHat className="h-3 w-3" />
                        Employee
                    </Badge>
                )
            case 'client':
                return (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 px-2 py-0.5">
                        <User className="h-3 w-3" />
                        Client
                    </Badge>
                )
            default:
                return null
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0">
                <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b bg-white/80 backdrop-blur-md px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="#">Workspace</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Dashboard</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                    <Separator orientation="vertical" className="mx-2 h-4" />
                    {getRoleBadge()}
                    <div className="ml-auto flex items-center gap-2">
                        {/* Notifications removed to reduce Firebase costs */}
                    </div>

                </header>

                <div className="flex flex-1 flex-col gap-4 px-0 pt-2 pb-24 md:pb-4 bg-white overflow-x-hidden w-full">
                    <PageTransition>
                        <Outlet />
                    </PageTransition>
                </div>

                <MobileNav />
            </SidebarInset>
        </SidebarProvider >
    )
}

