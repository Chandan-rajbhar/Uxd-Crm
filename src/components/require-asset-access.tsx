import { useAuth } from "@/contexts/AuthContext"
import { useEmployees } from "@/hooks/useEmployees"
import { Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"

export default function RequireAssetAccess() {
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

    // Check if employee belongs to Networking team
    const currentEmployee = employees.find(e =>
        e.authUid === user.uid ||
        (e.email && user.email && e.email.toLowerCase() === user.email.toLowerCase())
    )

    const checkNetworking = (val?: string) => {
        if (!val) return false;
        const n = val.trim().toLowerCase();
        return n.includes('network') || n.includes('networking') || n === 'it' || n.includes('information technology') || n.includes('infrastructure') || n.includes('sysadmin');
    }

    const isNetworking =
        checkNetworking(currentEmployee?.team) ||
        checkNetworking(currentEmployee?.department)

    if (isNetworking) {
        return <Outlet />
    }

    // Redirect to home if not authorized
    return <Navigate to="/" replace />
}
