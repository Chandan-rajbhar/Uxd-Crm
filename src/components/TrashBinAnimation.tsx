import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function TrashBinAnimation() {
    const containerRef = useRef<HTMLDivElement>(null);
    const lidRef = useRef<SVGGElement>(null);
    const binRef = useRef<SVGGElement>(null);
    const paperRef = useRef<SVGGElement>(null);

    useGSAP(() => {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });

        // Initial state
        gsap.set(paperRef.current, { y: -100, opacity: 0, scale: 0.5 });
        gsap.set(lidRef.current, { rotation: 0 });

        // Animation sequence
        tl.to(lidRef.current, {
            rotation: -45,
            duration: 0.3,
            ease: "power2.out",
            transformOrigin: "bottom left"
        })
            .to(paperRef.current, {
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.4,
                ease: "bounce.out"
            }, "-=0.1")
            .to(paperRef.current, {
                y: 100,
                scale: 0.2,
                opacity: 0,
                duration: 0.4,
                ease: "power2.in"
            })
            .to(lidRef.current, {
                rotation: 0,
                duration: 0.2,
                ease: "bounce.out"
            }, "-=0.2")
            .to(binRef.current, {
                scaleY: 0.95,
                scaleX: 1.05,
                duration: 0.1,
                yoyo: true,
                repeat: 1
            }, "-=0.1");

    }, { scope: containerRef });

    return (
        <div ref={containerRef} className="flex flex-col items-center justify-center h-48 w-full">
            <svg width="120" height="120" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
                {/* Trash Bin Group */}
                <g className="origin-bottom">

                    {/* The Paper that falls in */}
                    <g ref={paperRef} className="opacity-0">
                        <rect x="35" y="-40" width="30" height="40" rx="2" fill="white" stroke="#64748b" strokeWidth="2" />
                        <line x1="40" y1="-30" x2="60" y2="-30" stroke="#94a3b8" strokeWidth="2" />
                        <line x1="40" y1="-20" x2="60" y2="-20" stroke="#94a3b8" strokeWidth="2" />
                        <line x1="40" y1="-10" x2="55" y2="-10" stroke="#94a3b8" strokeWidth="2" />
                    </g>

                    {/* Bin Body */}
                    <g ref={binRef} className="origin-bottom">
                        <path d="M25 30 H75 L70 110 H30 L25 30 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="3" strokeLinejoin="round" />
                        {/* Bin details (lines) */}
                        <line x1="38" y1="40" x2="38" y2="100" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="50" y1="40" x2="50" y2="100" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="62" y1="40" x2="62" y2="100" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                    </g>

                    {/* Bin Lid */}
                    <g ref={lidRef} style={{ transformOrigin: "25px 30px" }}>
                        <path d="M20 30 H80 L75 20 H25 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="3" strokeLinejoin="round" />
                        <rect x="42" y="12" width="16" height="8" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="3" />
                    </g>
                </g>
            </svg>
            <p className="mt-4 text-muted-foreground font-medium animate-pulse">Deleting project...</p>
        </div>
    );
}
