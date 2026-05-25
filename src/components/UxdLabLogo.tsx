import { useEffect, useRef } from "react"
import gsap from "gsap"

export function UxdLabLogo({ className = "", textSize = "text-6xl", justify = "justify-center", showTag = false }: { className?: string, textSize?: string, justify?: string, showTag?: boolean }) {
    const ballRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (ballRef.current) {
            gsap.to(ballRef.current, {
                y: -5,
                duration: 0.6,
                repeat: -1,
                yoyo: true,
                ease: "power1.inOut",
            })
        }
    }, [])

    return (
        <div className={`relative flex items-center ${justify} font-bold ${textSize} tracking-tighter text-black ${className}`}>
            <span>u</span>
            <div className="relative">
                x
                <div
                    ref={ballRef}
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full"
                />
            </div>
            <span>dlab</span>
            {showTag && (
                <div className="ml-4 flex items-center">
                    <div className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest -rotate-12 shadow-sm">
                        Updates
                    </div>
                </div>
            )}
        </div>
    )
}
