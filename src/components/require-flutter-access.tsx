import { useAuth } from "@/contexts/AuthContext"
import { useEmployees } from "@/hooks/useEmployees"
import { Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"

export default function RequireFlutterAccess() {
    const { user, role, loading: authLoading } = useAuth()
    const { employees, loading: employeesLoading } = useEmployees()

    if (authLoading || employeesLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (role === 'admin') {
        return <Outlet />
    }

    const currentEmployee = employees.find(e => e.authUid === user.uid || e.email === user.email)

    const isFlutter = 
        currentEmployee?.role?.toLowerCase().includes('flutter') ||
        currentEmployee?.team?.toLowerCase().includes('flutter') ||
        currentEmployee?.department?.toLowerCase().includes('flutter');

    if (isFlutter) {
        return <Outlet />
    }

    return <Navigate to="/" replace />
}
