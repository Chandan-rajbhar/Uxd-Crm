import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { appLinkService } from "src/firebase/appLinkService"
import type { AppLink } from "src/firebase/appLinkService"
import { Loader2, AlertCircle } from "lucide-react"
import "react-quill/dist/quill.snow.css"

export default function ViewAppLink() {
    const { id } = useParams<{ id: string }>()
    const [link, setLink] = useState<AppLink | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            try {
                const data = await appLinkService.getAppLink(id);
                if (data) {
                    setLink(data);
                } else {
                    setError("Content not found");
                }
            } catch (err) {
                console.error("Error fetching app link:", err);
                setError("Failed to load content");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-slate-500 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    if (error || !link) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4 max-w-md w-full">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-bold text-slate-800">Oops!</h2>
                    <p className="text-slate-600 font-medium">{error || "Something went wrong"}</p>
                    <div className="pt-4">
                        <a 
                            href="/" 
                            className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-lg"
                        >
                            Back Home
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col items-center py-12 px-6">
            <article className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-slate-100 max-w-3xl w-full space-y-12">
                {/* Header Section */}
                {link.imageUrl && (
                    <div className="flex justify-center -mt-6">
                        <img 
                            src={link.imageUrl} 
                            alt="Logo" 
                            className="h-24 md:h-32 object-contain rounded-2xl p-2 bg-white"
                        />
                    </div>
                )}

                <div className="text-center space-y-4">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                        {link.heading}
                    </h1>
                </div>

                <div className="w-24 h-1.5 bg-primary/20 rounded-full mx-auto" />

                {/* Content Section */}
                <div className="max-w-none text-slate-700 leading-relaxed text-lg break-words ql-container ql-snow border-none">
                    <div 
                        className="ql-editor p-0"
                        dangerouslySetInnerHTML={{ __html: link.content }}
                    />
                </div>

                {/* Footer Section */}
                <footer className="pt-12 border-t border-slate-100 text-center">
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">
                        Document generated via UXDLab
                    </p>
                    <p className="text-slate-300 text-xs mt-2">
                        &copy; {new Date().getFullYear()} All Rights Reserved.
                    </p>
                </footer>
            </article>
        </div>
    );
}
