import { useEffect, useRef } from "react"
import gsap from "gsap"
import { UxdLabLogo } from "src/components/UxdLabLogo"
import { LoginForm } from "src/components/login-form"

export default function LoginPage() {
    const formSectionRef = useRef<HTMLDivElement>(null)
    const logoSectionRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const tl = gsap.timeline()

        tl.fromTo(formSectionRef.current,
            { x: -50, opacity: 0 },
            { x: 0, opacity: 1, duration: 1, ease: "power3.out" }
        )

        tl.fromTo(logoSectionRef.current,
            { x: 50, opacity: 0 },
            { x: 0, opacity: 1, duration: 1, ease: "power3.out" },
            "-=0.5" // Overlap animations
        )
    }, [])

    return (
        <div className="grid min-h-svh lg:grid-cols-2 overflow-hidden">
            <div ref={formSectionRef} className="flex flex-col gap-4 p-6 md:p-10 bg-white">
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-xs">
                        <LoginForm />
                    </div>
                </div>
            </div>
            <div ref={logoSectionRef} className="bg-muted relative hidden lg:flex items-center justify-center">
                <UxdLabLogo className="scale-[2]" showTag={true} />
            </div>
        </div>
    )
}
