import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import gsap from "gsap"

interface PageTransitionProps {
    children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const location = useLocation()

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        // Set initial state
        gsap.set(container, {
            opacity: 0,
            y: 12,
        })

        // Animate in
        gsap.to(container, {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: "power2.out",
        })

        // Cleanup function for exit animation would require more complex setup
        // For lightweight transitions, we just animate in
    }, [location.pathname])

    return (
        <div ref={containerRef} className="flex-1 flex flex-col">
            {children}
        </div>
    )
}
