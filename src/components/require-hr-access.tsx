import { useAuth } from "@/contexts/AuthContext"
import { useEmployees } from "@/hooks/useEmployees"
import { Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"

export default function RequireHRAccess({ allowTeamLead = false }: { allowTeamLead?: boolean }) {
    const { user, role, loading: authLoading } = useAuth()
    const { employees, loading: employeesLoading } = useEmployees()

    // Only show loading if we don't have user info OR (we are loading employees AND don't have any yet)
    // This prevents flashing loader when background re-validation occurs
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

    // Check if employee belongs to HR team
    const currentEmployee = employees.find(e =>
        e.authUid === user.uid ||
        (e.email && user.email && e.email.toLowerCase() === user.email.toLowerCase())
    )

    const checkHR = (val?: string) => {
        if (!val) return false;
        const n = val.trim().toLowerCase();
        return /\bhr\b/.test(n) || n.includes('human') || n.includes('humar') || n.includes('recruitment') || n.includes('talent');
    }

    const isHR =
        checkHR(currentEmployee?.team) ||
        checkHR(currentEmployee?.department)

    const isTeamLead = allowTeamLead && currentEmployee?.isTeamLead === true;

    if (isHR || isTeamLead) {
        return <Outlet />
    }

    // Redirect to home if not authorized
    return <Navigate to="/" replace />
}
