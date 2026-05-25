import { useAuth } from "@/contexts/AuthContext"
import { useEmployees } from "@/hooks/useEmployees"
import { Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"

export default function RequireMeetingAccess() {
    const { user, role, loading: authLoading } = useAuth()
    const { employees, loading: employeesLoading } = useEmployees()

    if (authLoading || (employeesLoading && employees.length === 0)) {
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

    const currentEmployee = employees.find(e =>
        e.authUid === user.uid ||
        (e.email && user.email && e.email.toLowerCase() === user.email.toLowerCase())
    )

    const checkBD = (val?: string) => {
        if (!val) return false;
        const n = val.trim().toLowerCase();
        return n === 'bde';
    }

    const checkDM = (val?: string) => {
        if (!val) return false;
        const n = val.trim().toLowerCase().replace(/\s+/g, '');
        return n === 'dm' || n === 'digitalmarketing';
    }

    const hasAccess =
        checkBD(currentEmployee?.team) ||
        checkBD(currentEmployee?.department) ||
        checkDM(currentEmployee?.team) ||
        checkDM(currentEmployee?.department)

    if (hasAccess) {
        return <Outlet />
    }

    return <Navigate to="/" replace />
}
