import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "src/contexts/AuthContext"
import { Loader2 } from "lucide-react"

export default function RequireAdmin() {
    const { user, loading, isAdmin, is2FAVerified } = useAuth()

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen w-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (!isAdmin) {
        // Redirect non-admins to a safe page (e.g. home/dashboard with limited view)
        // or logout if they shouldn't be here at all. 
        // For now, we keep them on root which might show empty dashboard.
        return <Navigate to="/" replace />
    }

    if (isAdmin && !is2FAVerified) {
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}
