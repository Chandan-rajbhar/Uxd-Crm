import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, X, UploadCloud } from "lucide-react"
import { assetService } from "src/firebase/assetService"
import { useEmployees } from "src/hooks/useEmployees"
import { storage } from "@/firebase/config"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

interface AddAssetSheetProps {
    assetToEdit?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export function AddAssetSheet({ assetToEdit, open, onOpenChange, trigger }: AddAssetSheetProps) {
    const { employees } = useEmployees()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<{
        model: string;
        category: string;
        assignedTo: string;
        status: string;
        description: string;
        extraItems: string;
        repairingDescription: string;
        uniqueCode: string;
        images: string[];
    }>({
        model: "",
        category: "",
        assignedTo: "",
        status: "Active",
        description: "",
        extraItems: "",
        repairingDescription: "",
        uniqueCode: "",
        images: [],
    })
    
    const [uploadingImages, setUploadingImages] = useState(false)

    const [internalOpen, setInternalOpen] = useState(false)

    // Use controlled state if provided, otherwise use internal state
    const isControlled = open !== undefined
    const showSheet = isControlled ? open : internalOpen

    const handleOpenChange = (newOpen: boolean) => {
        if (isControlled && onOpenChange) {
            onOpenChange(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
    }

    useEffect(() => {
        if (assetToEdit) {
            setFormData({
                ...assetToEdit
            })
        } else if (!showSheet) {
            // Reset form when closed if not editing
            setFormData({
                model: "",
                category: "",
                assignedTo: "",
                status: "Active",
                description: "",
                extraItems: "",
                repairingDescription: "",
                uniqueCode: "",
                images: [],
            })
        }
    }, [assetToEdit, showSheet])

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploadingImages(true)
        const toastId = toast.loading("Uploading images...")

        try {
            const newImageUrls = [...(formData.images || [])]
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const storageRef = ref(storage, `assets/${Date.now()}_${file.name}`)
                const snapshot = await uploadBytes(storageRef, file)
                const url = await getDownloadURL(snapshot.ref)
                newImageUrls.push(url)
            }

            setFormData(prev => ({ ...prev, images: newImageUrls }))
            toast.success(`${files.length} image(s) uploaded`, { id: toastId })
        } catch (error) {
            console.error("Image upload failed:", error)
            toast.error("Failed to upload images", { id: toastId })
        } finally {
            setUploadingImages(false)
        }
    }

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }))
    }

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async () => {
        if (!formData.model || !formData.category) {
            toast.error("Model and Category are required");
            return;
        }

        setLoading(true)
        try {
            if (assetToEdit?.id) {
                await assetService.updateAsset(assetToEdit.id, formData)
                toast.success("Asset updated successfully")
            } else {
                await assetService.addAsset(formData)
                toast.success("Asset added successfully")
            }

            // Close sheet
            handleOpenChange(false)
        } catch (error) {
            console.error(assetToEdit ? "Failed to update asset:" : "Failed to add asset:", error)
            toast.error(error instanceof Error ? error.message : "Failed to save asset")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={showSheet} onOpenChange={handleOpenChange}>
            {trigger !== undefined ? (
                trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>
            ) : !assetToEdit && (
                <SheetTrigger asChild>
                    <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Add Asset
                    </Button>
                </SheetTrigger>
            )}
            <SheetContent className="overflow-y-auto w-full sm:max-w-[500px] flex flex-col">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">{assetToEdit ? "Updating..." : "Adding Asset..."}</p>
                    </div>
                )}
                <SheetHeader>
                    <SheetTitle>
                        {assetToEdit ? "Edit Asset" : "Add New Asset"}
                    </SheetTitle>
                    <SheetDescription>
                        {assetToEdit ? "Update asset details below." : "Enter the details for the new IT asset."}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="model">Model Name</Label>
                            <Input
                                id="model"
                                placeholder="e.g. Dell Optiplex 3020"
                                value={formData.model}
                                onChange={(e) => handleChange('model', e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="uniqueCode">Asset Code (Unique)</Label>
                            <Input
                                id="uniqueCode"
                                placeholder="e.g. UXD-DEL-001"
                                value={formData.uniqueCode || ""}
                                onChange={(e) => handleChange('uniqueCode', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(v) => handleChange('category', v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Desktop">Desktop</SelectItem>
                                    <SelectItem value="Laptop">Laptop</SelectItem>
                                    <SelectItem value="Monitor">Monitor</SelectItem>
                                    <SelectItem value="Accessories">Accessories</SelectItem>
                                    <SelectItem value="Mobile">Mobile</SelectItem>
                                    <SelectItem value="Tablet">Tablet</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(v) => handleChange('status', v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="In Repair">In Repair</SelectItem>
                                    <SelectItem value="Retired">Retired</SelectItem>
                                    <SelectItem value="Lost">Lost</SelectItem>
                                    <SelectItem value="Available">Available</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="assignedTo">Assigned To</Label>
                        <Select
                            value={formData.assignedTo}
                            onValueChange={(v) => handleChange('assignedTo', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Unassigned">Unassigned</SelectItem>
                                {employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.name}>
                                        {emp.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Description (Specs)</Label>
                        <Textarea
                            id="description"
                            placeholder="Processor, RAM, Storage details..."
                            className="min-h-[100px]"
                            value={formData.description || ""}
                            onChange={(e) => handleChange('description', e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="extraItems">Extra Items</Label>
                        <Input
                            id="extraItems"
                            placeholder="e.g. Keyboard, Mouse, Charger"
                            value={formData.extraItems || ""}
                            onChange={(e) => handleChange('extraItems', e.target.value)}
                        />
                    </div>

                    {formData.status === 'In Repair' && (
                        <div className="grid gap-2">
                            <Label htmlFor="repairingDescription">Repair Details</Label>
                            <Textarea
                                id="repairingDescription"
                                placeholder="Describe the issue or repair status..."
                                className="min-h-[80px]"
                                value={formData.repairingDescription || ""}
                                onChange={(e) => handleChange('repairingDescription', e.target.value)}
                            />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label>Asset Pictures</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {formData.images?.map((url, index) => (
                                <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                                    <img src={url} alt="Asset" className="h-full w-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(index)}
                                        className="absolute top-1 right-1 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handleImageUpload}
                                    disabled={uploadingImages}
                                />
                                {uploadingImages ? (
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                ) : (
                                    <>
                                        <UploadCloud className="h-6 w-6 text-muted-foreground mb-1" />
                                        <span className="text-[10px] font-medium text-muted-foreground">Upload</span>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {assetToEdit ? "Save Changes" : "Add Asset"}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}
