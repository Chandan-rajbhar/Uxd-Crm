import { Search } from "lucide-react";

export function MagnifyingGlassLoader() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] w-full">
            <div className="relative">
                <Search className="w-12 h-12 text-primary animate-search" strokeWidth={2} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
                Searching...
            </p>
        </div>
    );
}
