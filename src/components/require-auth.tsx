import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "src/contexts/AuthContext"
import { Loader2 } from "lucide-react"
import { DataSync } from "./DataSync"

export default function RequireAuth() {
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

    if (isAdmin && !is2FAVerified) {
        return <Navigate to="/login" replace />
    }

    return (
        <>
            <DataSync />
            <Outlet />
        </>
    )
}
