import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState, useEffect, useRef } from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import { setAssets, setLoading, setError } from "@/store/slices/assetsSlice"
import { assetService } from "@/firebase/assetService"
import { assetIssueService, type AssetIssue } from "@/firebase/assetIssueService"
import { AddAssetSheet } from "@/components/AddAssetSheet"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { 
    Monitor, 
    Smartphone, 
    Laptop, 
    Wrench, 
    Box, 
    Upload, 
    Printer, 
    Clock, 
    Plus, 
    Search,
    PauseCircle,
    MoreHorizontal,
    Edit,
    Trash2,
    Loader2,
    CheckCircle2,
    CheckCircle,
    User,
    AlertCircle,
    X,
    ChevronLeft,
    ChevronRight
} from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"
import { storage } from "@/firebase/config"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export default function AssetsPage() {
    const dispatch = useAppDispatch()
    const assets = useAppSelector((state) => state.assets?.items || [])
    const loading = useAppSelector((state) => state.assets?.loading || false)

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [assetToEdit, setAssetToEdit] = useState<any>(null)

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [assetToDelete, setAssetToDelete] = useState<any>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Search State
    const [searchTerm, setSearchTerm] = useState("")
    const [stats, setStats] = useState({ total: 0, active: 0, inRepair: 0, unassigned: 0 })

    // Issues State
    const [allIssues, setAllIssues] = useState<AssetIssue[]>([])
    const [markingFixed, setMarkingFixed] = useState<string | null>(null)

    // Quick Image Upload
    const quickFileInputRef = useRef<HTMLInputElement>(null)
    const [quickUploadAssetId, setQuickUploadAssetId] = useState<string | null>(null)
    const [isUploadingQuick, setIsUploadingQuick] = useState(false)
    
    // Image Preview State
    const [previewAssetId, setPreviewAssetId] = useState<string | null>(null)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [previewImages, setPreviewImages] = useState<string[]>([])
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isDeletingImage, setIsDeletingImage] = useState(false)

    useEffect(() => {
        dispatch(setLoading(true));
        
        // Fetch stats once on mount (aggregate queries)
        assetService.getAssetStats().then(setStats).catch(console.error);

        const unsubscribe = assetService.subscribeToAssets(
            (data, error) => {
                if (error) {
                    dispatch(setError(error.message));
                    dispatch(setLoading(false));
                } else {
                    dispatch(setAssets(data));
                    dispatch(setLoading(false));
                }
            },
            null, // Broad mode
            500   // Sufficient for total inventory
        );

        const unsubscribeIssues = assetIssueService.subscribeToAllIssues((issues) => {
            setAllIssues(issues);
        });

        return () => {
            unsubscribe();
            unsubscribeIssues();
        };
    }, [dispatch, searchTerm]);

    const handleMarkFixed = async (issueId: string) => {
        setMarkingFixed(issueId)
        try {
            await assetIssueService.markAsFixed(issueId)
            toast.success("Issue marked as fixed.")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update issue status.")
        } finally {
            setMarkingFixed(null)
        }
    }

    const filteredAssets = assets.filter(asset => {
        const search = searchTerm.toLowerCase()
        return (
            asset.model?.toLowerCase().includes(search) ||
            asset.assignedTo?.toLowerCase().includes(search) ||
            asset.category?.toLowerCase().includes(search) ||
            asset.uniqueCode?.toLowerCase().includes(search)
        )
    })

    const handleEditAsset = (asset: any) => {
        setAssetToEdit(asset)
        setIsEditOpen(true)
    }

    const handleDeleteClick = (asset: any) => {
        setAssetToDelete(asset)
        setIsDeleteOpen(true)
    }

    const confirmDelete = async () => {
        if (assetToDelete?.id) {
            setIsDeleting(true)
            try {
                await assetService.deleteAsset(assetToDelete.id)
                toast.success("Asset deleted successfully")
            } catch (error) {
                console.error("Failed to delete asset:", error)
                toast.error("Failed to delete asset")
            } finally {
                setIsDeleting(false)
                setIsDeleteOpen(false)
                setAssetToDelete(null)
            }
        }
    }

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Desktop': return <Monitor className="h-4 w-4" />;
            case 'Laptop': return <Laptop className="h-4 w-4" />;
            case 'Mobile':
            case 'Tablet': return <Smartphone className="h-4 w-4" />;
            case 'Accessories': return <Wrench className="h-4 w-4" />;
            default: return <Box className="h-4 w-4" />;
        }
    }

    // Import Logic
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isImporting, setIsImporting] = useState(false)

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        const reader = new FileReader()

        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string)
                if (!Array.isArray(json)) throw new Error("File must contain a JSON array of assets")

                let count = 0
                for (const item of json) {
                    // Basic validation/mapping
                    const asset = {
                        model: item.model || item.name || "Unknown Model",
                        category: item.category || "Other",
                        assignedTo: item.assignedTo || item.assigned_to || "Unassigned",
                        status: item.status || "Active",
                        description: item.description || item.specs || "",
                        extraItems: item.extraItems || item.accessories || "",
                        repairingDescription: item.repairingDescription || "",
                        uniqueCode: item.uniqueCode || item.code || "",
                    }
                    await assetService.addAsset(asset)
                    count++
                }
                toast.success(`Successfully imported ${count} assets`)
            } catch (error) {
                console.error("Import failed:", error)
                toast.error("Failed to import assets. Check JSON format.")
            } finally {
                setIsImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = ""
            }
        }

        reader.readAsText(file)
    }

    const handleQuickImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0 || !quickUploadAssetId) return

        setIsUploadingQuick(true)
        const toastId = toast.loading("Uploading image...")

        try {
            const asset = assets.find(a => a.id === quickUploadAssetId)
            const currentImages = asset?.images || []
            
            const newImageUrls = [...currentImages]
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const storageRef = ref(storage, `assets/${Date.now()}_${file.name}`)
                const snapshot = await uploadBytes(storageRef, file)
                const url = await getDownloadURL(snapshot.ref)
                newImageUrls.push(url)
            }

            await assetService.updateAsset(quickUploadAssetId, { images: newImageUrls })
            toast.success("Image added successfully", { id: toastId })
        } catch (error) {
            console.error("Quick upload failed:", error)
            toast.error("Failed to upload image", { id: toastId })
        } finally {
            setIsUploadingQuick(false)
            setQuickUploadAssetId(null)
            if (quickFileInputRef.current) quickFileInputRef.current.value = ""
        }
    }

    const triggerQuickUpload = (assetId: string) => {
        setQuickUploadAssetId(assetId)
        quickFileInputRef.current?.click()
    }

    const openPreview = (assetId: string, images: string[], index: number = 0) => {
        if (!images || images.length === 0) return
        setPreviewAssetId(assetId)
        setPreviewImages(images)
        setCurrentImageIndex(index)
        setIsPreviewOpen(true)
    }

    const handleNextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % previewImages.length)
    }

    const handlePrevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length)
    }

    const handleDeletePreviewImage = async () => {
        if (!previewAssetId || isDeletingImage) return

        setIsDeletingImage(true)
        try {
            const newImages = previewImages.filter((_, i) => i !== currentImageIndex)
            await assetService.updateAsset(previewAssetId, { images: newImages })
            
            if (newImages.length === 0) {
                setIsPreviewOpen(false)
            } else {
                setPreviewImages(newImages)
                setCurrentImageIndex(prev => Math.min(prev, newImages.length - 1))
            }
            toast.success("Image deleted successfully")
        } catch (error) {
            console.error("Failed to delete image:", error)
            toast.error("Failed to delete image")
        } finally {
            setIsDeletingImage(false)
        }
    }

    // Export PDF Logic
    const handleExportPDF = () => {
        const doc = new jsPDF()

        // Header
        doc.setFontSize(20)
        doc.text("IT Assets Inventory", 14, 22)

        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text("UXD Lab Asset Management System", 14, 28)
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 33)

        // Table Data
        const tableColumn = ["Asset Code", "Model Spec", "Category", "Assigned To", "Status", "Description"]
        const tableRows = filteredAssets.map(asset => [
            asset.uniqueCode || "-",
            `${asset.model}${asset.extraItems ? ` + ${asset.extraItems}` : ''}`,
            asset.category,
            asset.assignedTo || "Unassigned",
            asset.status,
            asset.description
        ])

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [41, 41, 46] }, // Dark header
            alternateRowStyles: { fillColor: [245, 245, 245] },
            columnStyles: {
                0: { cellWidth: 40 }, // Model
                4: { cellWidth: 60 }  // Description
            }
        })

        doc.save("IT_Assets_Inventory.pdf")
    }

    const derivedStats = {
        total: Math.max(stats.total, assets.length),
        active: Math.max(stats.active, assets.filter(a => a.status === "Active").length),
        inRepair: Math.max(stats.inRepair, assets.filter(a => a.status === "In Repair").length),
        unassigned: Math.max(stats.unassigned, assets.filter(a => !a.assignedTo || a.assignedTo === 'Unassigned').length)
    };

    return (
        <div className="flex-1 flex flex-col p-8 pt-6 min-h-[calc(100vh-4.5rem)]">
            <div className="mb-8 flex justify-between items-center">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Assets Management</h2>
                    <p className="text-muted-foreground italic text-sm">Track physical inventory and system support requests.</p>
                </div>
            </div>

            <Tabs defaultValue="inventory" className="space-y-6">
                <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-11 p-0 gap-8">
                    <TabsTrigger value="inventory" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 shadow-none font-medium h-11 text-slate-500 data-[state=active]:text-slate-900 transition-all">
                        <Box className="h-4 w-4 mr-2" />
                        Inventory
                    </TabsTrigger>
                    <TabsTrigger value="issues" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 shadow-none font-medium h-11 text-slate-500 data-[state=active]:text-slate-900 transition-all">
                        <Wrench className="h-4 w-4 mr-2" />
                        System Issues
                        {allIssues.filter(i => i.status === 'Pending').length > 0 && (
                            <Badge className="ml-2 bg-red-500 hover:bg-red-600 text-[10px] h-4 px-1 leading-none rounded-full min-w-[16px] flex items-center justify-center">
                                {allIssues.filter(i => i.status === 'Pending').length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="inventory" className="space-y-6 outline-none">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-md bg-white hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Assets</CardTitle>
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Box className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">{derivedStats.total}</div>
                        <p className="text-xs text-slate-400 mt-1">Full inventory</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-white hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Active</CardTitle>
                        <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                            <Clock className="h-4 w-4 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">{derivedStats.active}</div>
                        <p className="text-xs text-green-500 mt-1">Ready for use</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-white hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">In Repair</CardTitle>
                        <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <Wrench className="h-4 w-4 text-orange-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">{derivedStats.inRepair}</div>
                        <p className="text-xs text-orange-500 mt-1">Maintenance required</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-white hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Unassigned</CardTitle>
                        <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center">
                            <PauseCircle className="h-4 w-4 text-amber-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">{derivedStats.unassigned}</div>
                        <p className="text-xs text-amber-500 mt-1">Available to assign</p>
                    </CardContent>
                </Card>
            </div>

            {/* Header with search and buttons on same row */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search assets..."
                            className="pl-9 bg-white border-slate-200"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".json"
                    />
                    <Button variant="outline" size="sm" onClick={handleImportClick} disabled={isImporting} className="rounded-full">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4 font-bold" />}
                        Import JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-full">
                        <Printer className="mr-2 h-4 w-4" />
                        Export PDF
                    </Button>
                    <AddAssetSheet />
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse font-medium">Loading inventory...</p>
                </div>
            ) : filteredAssets.length === 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                    <Empty className="max-w-md">
                        <EmptyMedia className="h-20 w-20 bg-primary/5 rounded-full mb-4">
                            <Box className="h-10 w-10 text-primary/40" />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle className="text-2xl">No assets found</EmptyTitle>
                            <EmptyDescription className="text-base">
                                Create your first asset to track inventory.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <AddAssetSheet trigger={
                                <Button size="lg" className="px-8 shadow-lg shadow-primary/20 transition-all hover:scale-105">
                                    <Plus className="mr-2 h-5 w-5" /> Add Asset
                                </Button>
                            } />
                        </EmptyContent>
                    </Empty>
                </div>
            ) : (
                <div className="">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="py-3">Asset Code</TableHead>
                                <TableHead className="py-3">Photo</TableHead>
                                <TableHead className="py-3">Model Spec</TableHead>
                                <TableHead className="py-3">Category</TableHead>
                                <TableHead className="py-3">Assigned To</TableHead>
                                <TableHead className="py-3">Status</TableHead>
                                <TableHead className="py-3">Description</TableHead>
                                <TableHead className="text-right py-3">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAssets.map((asset: any) => (
                                <TableRow key={asset.id} className="group hover:bg-muted/50">
                                    <TableCell className="font-mono text-xs font-bold text-slate-500 py-3">
                                        {asset.uniqueCode || "-"}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-2">
                                            {asset.images && asset.images.length > 0 ? (
                                                <div 
                                                    className="relative h-10 w-10 rounded-lg overflow-hidden border bg-muted cursor-pointer hover:ring-2 ring-primary/20 transition-all"
                                                    onClick={() => openPreview(asset.id, asset.images)}
                                                >
                                                    <img src={asset.images[0]} alt="" className="h-full w-full object-cover" />
                                                    {asset.images.length > 1 && (
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[10px] text-white font-bold">
                                                            +{asset.images.length - 1}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <Button 
                                                    variant="outline" 
                                                    size="icon" 
                                                    className="h-10 w-10 rounded-lg border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
                                                    onClick={() => triggerQuickUpload(asset.id)}
                                                    disabled={isUploadingQuick && quickUploadAssetId === asset.id}
                                                >
                                                    {isUploadingQuick && quickUploadAssetId === asset.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                    ) : (
                                                        <Plus className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium py-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold">{asset.model}</span>
                                            {asset.extraItems && (
                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={asset.extraItems}>
                                                    + {asset.extraItems}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-2">
                                            {getCategoryIcon(asset.category)}
                                            {asset.category}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        {asset.assignedTo && asset.assignedTo !== 'Unassigned' ? (
                                            <Badge variant="secondary" className="font-medium text-white">
                                                {asset.assignedTo}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm italic">Unassigned</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Badge variant={
                                            asset.status === 'Active' ? 'default' :
                                                asset.status === 'In Repair' ? 'destructive' :
                                                    'outline'
                                        }>
                                            {asset.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                            {asset.description}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-right py-3">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted rounded-full">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEditAsset(asset)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => triggerQuickUpload(asset.id)}>
                                                    <Upload className="mr-2 h-4 w-4" /> Add Photo
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDeleteClick(asset)} className="text-destructive focus:text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </TabsContent>

                <TabsContent value="issues" className="outline-none">
                    <div className="bg-white rounded-xl border-none shadow-sm overflow-hidden min-h-[500px]">
                        <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-red-500" />
                                Support Requests
                            </h3>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="bg-white text-orange-600 border-orange-200">
                                    {allIssues.filter(i => i.status === 'Pending').length} Pending
                                </Badge>
                                <Badge variant="outline" className="bg-white text-emerald-600 border-emerald-200">
                                    {allIssues.filter(i => i.status === 'Fixed').length} Fixed
                                </Badge>
                            </div>
                        </div>

                        <div className="divide-y">
                            {allIssues.length === 0 ? (
                                <div className="p-20 flex flex-col items-center justify-center text-center">
                                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Wrench className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <h4 className="text-slate-900 font-bold">No issues reported</h4>
                                    <p className="text-slate-400 text-sm">Everything seems to be running smoothly.</p>
                                </div>
                            ) : (
                                allIssues.map((issue) => (
                                    <div key={issue.id} className={`p-6 hover:bg-slate-50 transition-colors group ${issue.status === 'Fixed' ? 'opacity-70' : ''}`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-4">
                                                <div className={`mt-1 p-2 rounded-xl ${issue.status === 'Fixed' ? 'bg-emerald-50' : 'bg-red-50 text-red-500 animate-pulse'}`}>
                                                    {issue.status === 'Fixed' ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5" />}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="font-bold text-slate-900 uppercase tracking-tight">{issue.category}</h4>
                                                        <Badge variant={issue.status === 'Fixed' ? 'default' : 'destructive'} className={issue.status === 'Fixed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 uppercase text-[10px]' : 'uppercase text-[10px]'}>
                                                            {issue.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{issue.description}</p>
                                                    <div className="flex items-center gap-4 mt-4">
                                                        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
                                                            <User className="h-3 w-3 text-slate-500" />
                                                            <span className="text-[11px] font-bold text-slate-700">{issue.employeeName}</span>
                                                        </div>
                                                        <span className="text-[11px] text-slate-400">
                                                            {issue.createdAt?.seconds ? new Date(issue.createdAt.seconds * 1000).toLocaleString() : 'Saving...'}
                                                        </span>
                                                        {issue.status === 'Fixed' && issue.fixedAt && (
                                                            <span className="text-[11px] text-emerald-600 font-medium">
                                                                Fixed on {new Date(issue.fixedAt.seconds * 1000).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {issue.status === 'Pending' && (
                                                <Button 
                                                    size="sm" 
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-8 shadow-sm shadow-emerald-100"
                                                    onClick={() => handleMarkFixed(issue.id!)}
                                                    disabled={markingFixed === issue.id}
                                                >
                                                    {markingFixed === issue.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                    Mark as Fixed
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Moved Sheets/Dialogs to end for cleaner flow */}
            <AddAssetSheet
                open={isEditOpen}
                onOpenChange={(open) => {
                    setIsEditOpen(open)
                    if (!open) setAssetToEdit(null)
                }}
                assetToEdit={assetToEdit}
                trigger={null}
            />

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the asset
                            <span className="font-semibold text-foreground"> {assetToDelete?.model} </span>
                            and remove all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <input
                type="file"
                ref={quickFileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleQuickImageUpload}
            />

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-none w-screen h-screen p-0 border-none bg-transparent shadow-none [&>button]:hidden">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Asset Preview</DialogTitle>
                    </DialogHeader>
                    <div className="relative h-full w-full flex flex-col group backdrop-blur-sm bg-black/60">
                        {/* Immersive Toolbar */}
                        <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-50 pointer-events-none">
                            <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full text-white text-xs font-bold border border-white/10 shadow-2xl">
                                {currentImageIndex + 1} / {previewImages.length}
                            </div>
                            <div className="flex gap-4 pointer-events-auto">
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="rounded-full h-11 px-6 text-xs bg-red-500/90 hover:bg-red-500 font-bold shadow-2xl transition-all hover:scale-105 active:scale-95"
                                    onClick={handleDeletePreviewImage}
                                    disabled={isDeletingImage}
                                >
                                    {isDeletingImage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                    Delete Photo
                                </Button>
                                <Button 
                                    variant="secondary" 
                                    size="icon" 
                                    className="rounded-full h-11 w-11 bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-xl shadow-2xl transition-all hover:rotate-90" 
                                    onClick={() => setIsPreviewOpen(false)}
                                >
                                    <X className="h-6 w-6" />
                                </Button>
                            </div>
                        </div>

                        {/* Immersive Navigation */}
                        {previewImages.length > 1 && (
                            <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                                    className="absolute left-8 top-1/2 -translate-y-1/2 h-20 w-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/5 backdrop-blur-md z-40 hover:scale-105"
                                >
                                    <ChevronLeft className="h-10 w-10" />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                                    className="absolute right-8 top-1/2 -translate-y-1/2 h-20 w-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/5 backdrop-blur-md z-40 hover:scale-105"
                                >
                                    <ChevronRight className="h-10 w-10" />
                                </button>
                            </>
                        )}

                        {/* Large Image Area */}
                        <div className="flex-1 w-full flex items-center justify-center p-12" onClick={() => setIsPreviewOpen(false)}>
                            <img 
                                src={previewImages[currentImageIndex]} 
                                alt={`Asset photo ${currentImageIndex + 1}`} 
                                className="max-h-full max-w-full object-contain shadow-[0_0_80px_rgba(0,0,0,0.5)] rounded-2xl transition-all duration-500 transform snap-center" 
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        {/* Minimal Thumbnails Overlay */}
                        {previewImages.length > 1 && (
                            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 p-4 bg-black/20 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-2xl transition-all opacity-60 hover:opacity-100 z-50">
                                {previewImages.map((url, i) => (
                                    <div 
                                        key={i} 
                                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i); }}
                                        className={`h-16 w-16 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                                            i === currentImageIndex 
                                            ? 'border-white scale-125 shadow-2xl ring-4 ring-white/10' 
                                            : 'border-transparent grayscale opacity-40 hover:opacity-100 hover:grayscale-0 hover:scale-110'
                                        }`}
                                    >
                                        <img src={url} alt="" className="h-full w-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
