import { useAuth } from "@/contexts/AuthContext"
import { useEmployees } from "@/hooks/useEmployees"
import { Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"

export default function RequireBlogAccess() {
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

    // Check if employee belongs to Digital Marketing team (flexible matching)
    const currentEmployee = employees.find(e => e.authUid === user.uid || e.email === user.email)

    const checkDM = (val?: string) => {
        if (!val) return false;
        const n = val.trim().toLowerCase().replace(/\s+/g, '');
        return n === 'dm' || n === 'digitalmarketing';
    }

    const isDigitalMarketing =
        checkDM(currentEmployee?.team) ||
        checkDM(currentEmployee?.department)

    if (isDigitalMarketing) {
        return <Outlet />
    }

    // Redirect to home if not authorized
    return <Navigate to="/" replace />
}
