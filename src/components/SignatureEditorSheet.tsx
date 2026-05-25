import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "src/components/ui/sheet"
import { Button } from "src/components/ui/button"
import { Input } from "src/components/ui/input"
import { Label } from "src/components/ui/label"
import { Save, Loader2, PenTool, Eye, ImagePlus, Upload, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "src/store/store"
import { fetchSignature, saveSignature } from "src/store/slices/signaturesSlice"
import type { SignatureFormData } from "src/store/slices/signaturesSlice"
import { useEmployees } from "src/hooks/useEmployees"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { storage } from "src/firebase/config"

interface SignatureEditorSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentUser: any
}

const defaultFormData: SignatureFormData = {
    name: '',
    designation: '',
    phone: '',
    mobile: '',
    website: 'www.uxdlab.com',
    photoUrl: '',
    logoUrl: '',
}

/**
 * Generate the email signature HTML in the exact company format:
 * - "Best regards," header
 * - Photo on left, name/title/contacts on right
 * - UXDLab logo + tagline
 * - Office addresses (USA, Canada, India)
 */
function generateSignatureHtml(data: SignatureFormData): string {
    const photoBlock = data.photoUrl
        ? `<img src="${data.photoUrl}" alt="${data.name}" width="120" height="120" style="width:120px;height:120px;border-radius:4px;object-fit:cover;display:block;" />`
        : `<div style="width:120px;height:120px;border-radius:4px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:36px;font-weight:700;">${data.name ? data.name.charAt(0).toUpperCase() : '?'}</div>`

    const logoBlock = data.logoUrl
        ? `<img src="${data.logoUrl}" alt="Company Logo" height="32" style="height:32px;display:block;margin-bottom:4px;" />`
        : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:4px;">
        <tr>
          <td style="padding:0;font-size:28px;font-weight:800;color:#111827;letter-spacing:-1.5px;line-height:1;">u</td>
          <td style="padding:0;vertical-align:bottom;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td align="center" style="padding:0 0 2px 0;line-height:1;">
                  <span style="display:inline-block;width:6px;height:6px;background-color:#ec4899;border-radius:50;font-size:0;">&#8204;</span>
                </td>
              </tr>
              <tr>
                <td style="padding:0;font-size:28px;font-weight:800;color:#111827;letter-spacing:-1.5px;line-height:1;">x</td>
              </tr>
            </table>
          </td>
          <td style="padding:0;font-size:28px;font-weight:800;color:#111827;letter-spacing:-1.5px;line-height:1;vertical-align:bottom;">dlab</td>
        </tr>
      </table>`;

    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;">
  <tr>
    <td style="padding:0 0 16px 0;">
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.4;">Best regards,</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0;">
      <div style="height:2px;background:#111827;margin:0 0 20px 0;"></div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 20px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0 24px 0 0;vertical-align:top;">
            ${photoBlock}
          </td>
          <td style="padding:0;vertical-align:top;">
            <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;color:#111827;line-height:1.3;">${data.name || 'Your Name'}</p>
            <p style="margin:0 0 16px 0;font-size:14px;color:#6b7280;line-height:1.4;">${data.designation || 'Designation'}</p>
            ${data.phone ? `<p style="margin:0 0 4px 0;font-size:13px;color:#374151;line-height:1.5;"><strong style="color:#111827;">T:</strong> ${data.phone}</p>` : ''}
            ${data.mobile ? `<p style="margin:0 0 4px 0;font-size:13px;color:#374151;line-height:1.5;"><strong style="color:#111827;">M:</strong> ${data.mobile}</p>` : ''}
            ${data.website ? `<p style="margin:0;font-size:13px;color:#374151;line-height:1.5;"><strong style="color:#111827;">W:</strong> <a href="https://${data.website.replace(/^https?:\/\//, '')}" style="color:#2563eb;text-decoration:none;">${data.website.replace(/^https?:\/\//, '')}</a></p>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 12px 0;">
      ${logoBlock}
      <p style="margin:0;font-size:12px;color:#6b7280;font-style:italic;line-height:1.5;">"Innovating with Technology, Delivering with Excellence."</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0;">
      <p style="margin:0 0 4px 0;font-size:12px;color:#374151;line-height:1.6;"><strong style="color:#111827;">USA Office</strong> | 720 Market St, San Francisco, CA 94102</p>
      <p style="margin:0 0 4px 0;font-size:12px;color:#374151;line-height:1.6;"><strong style="color:#111827;">Canada Office</strong> | 10 George St. North, Suite 202, Brampton, ON L6X 1R2</p>
      <p style="margin:0;font-size:12px;color:#374151;line-height:1.6;"><strong style="color:#111827;">India Office</strong> | A-27, Majestic Signia, Sector 62, Noida | Uttar Pradesh 201309, India</p>
    </td>
  </tr>
</table>`
}

export function SignatureEditorSheet({ open, onOpenChange, currentUser }: SignatureEditorSheetProps) {
    const dispatch = useDispatch<AppDispatch>()
    const { signature, loading } = useSelector((state: RootState) => state.signatures)
    const { employees } = useEmployees()

    const [formData, setFormData] = useState<SignatureFormData>({ ...defaultFormData })
    const [saving, setSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)

    const currentEmployee = employees.find(e => e.authUid === currentUser?.uid || e.email === currentUser?.email)

    useEffect(() => {
        if (open && currentUser?.uid) {
            dispatch(fetchSignature(currentUser.uid))
        }
    }, [open, currentUser, dispatch])

    // Populate form when signature loads
    useEffect(() => {
        if (signature?.formData) {
            setFormData(signature.formData)
        } else if (open && !loading && !signature) {
            // Pre-populate with employee info
            setFormData({
                ...defaultFormData,
                name: currentEmployee?.name || currentUser?.displayName || '',
                designation: currentEmployee?.role || '',
                photoUrl: currentEmployee?.avatar || '',
            })
        }
    }, [signature, open, loading, currentEmployee, currentUser])

    const handleChange = (field: keyof SignatureFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file")
            return
        }

        // Show instant preview
        const tempUrl = URL.createObjectURL(file)
        setFormData(prev => ({ ...prev, photoUrl: tempUrl }))

        setUploadingPhoto(true)
        try {
            const storageRef = ref(storage, `signatures/${currentUser.uid}/${Date.now()}_${file.name}`)
            const uploadTask = uploadBytesResumable(storageRef, file)

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', null,
                    (error: any) => reject(error),
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
                        setFormData(prev => ({ ...prev, photoUrl: downloadURL }))
                        toast.success("Photo uploaded!")
                        resolve()
                    }
                )
            })
        } catch (error) {
            console.error("Upload error:", error)
            toast.error("Failed to upload photo")
            // Revert on error
            setFormData(prev => ({ ...prev, photoUrl: '' }))
        } finally {
            setUploadingPhoto(false)
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file")
            return
        }

        // Show instant preview
        const tempUrl = URL.createObjectURL(file)
        setFormData(prev => ({ ...prev, logoUrl: tempUrl }))

        setUploadingLogo(true)
        try {
            const storageRef = ref(storage, `signatures/${currentUser.uid}/logo_${Date.now()}_${file.name}`)
            const uploadTask = uploadBytesResumable(storageRef, file)

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', null,
                    (error: any) => reject(error),
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
                        setFormData(prev => ({ ...prev, logoUrl: downloadURL }))
                        toast.success("Logo uploaded!")
                        resolve()
                    }
                )
            })
        } catch (error) {
            console.error("Upload error:", error)
            toast.error("Failed to upload logo")
            setFormData(prev => ({ ...prev, logoUrl: '' }))
        } finally {
            setUploadingLogo(false)
        }
    }

    const handleSave = async () => {
        if (!currentUser?.uid) return
        if (!formData.name.trim()) {
            toast.error("Please enter your name")
            return
        }

        setSaving(true)
        try {
            const signatureHtml = generateSignatureHtml(formData)
            await dispatch(saveSignature({
                userId: currentUser.uid,
                signatureHtml,
                formData,
            })).unwrap()
            toast.success("Signature saved successfully!")
        } catch (error) {
            toast.error("Failed to save signature")
        } finally {
            setSaving(false)
        }
    }

    const previewHtml = generateSignatureHtml(formData)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-[600px] w-full flex flex-col h-full bg-slate-50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <SheetHeader className="pb-4 border-b px-2">
                    <SheetTitle className="text-lg font-semibold flex items-center gap-2">
                        <PenTool className="h-5 w-5 text-primary" />
                        Email Signature
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {/* Info Banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-medium text-blue-800">
                            Fill in your details below to generate your professional email signature. It will be automatically appended to all outgoing emails.
                        </p>
                    </div>

                    {/* Toggle Preview */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">
                            {showPreview ? 'Signature Preview' : 'Your Details'}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPreview(!showPreview)}
                            className="h-8 gap-1.5 text-xs"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            {showPreview ? 'Edit' : 'Preview'}
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Loading signature...
                        </div>
                    ) : showPreview ? (
                        /* Preview Mode */
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 py-2 bg-slate-100 border-b">
                                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Email Signature Preview</span>
                            </div>
                            <div className="p-6">
                                <div
                                    className="signature-preview"
                                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Form Mode */
                        <div className="space-y-4">
                            {/* Photo Upload */}
                            <div className="bg-white border rounded-xl shadow-sm p-4">
                                <Label className="text-xs uppercase text-muted-foreground font-semibold mb-3 block">Profile Photo</Label>
                                <div className="flex items-center gap-4">
                                    {formData.photoUrl ? (
                                        <div className="relative group rounded-lg h-20 w-20 shrink-0">
                                            <img
                                                src={formData.photoUrl}
                                                alt="Profile"
                                                className="h-full w-full rounded-lg object-cover border border-slate-200 shadow-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleChange('photoUrl', '')}
                                                className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-600 z-10"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="h-20 w-20 rounded-lg bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                                            <ImagePlus className="h-6 w-6 text-slate-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePhotoUpload}
                                                className="hidden"
                                            />
                                            <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                                                {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                                            </div>
                                        </label>
                                        <p className="text-[10px] text-muted-foreground">Or paste a URL below:</p>
                                        <Input
                                            value={formData.photoUrl}
                                            onChange={e => handleChange('photoUrl', e.target.value)}
                                            placeholder="https://example.com/photo.jpg"
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Logo Upload */}
                            <div className="bg-white border rounded-xl shadow-sm p-4 mt-4">
                                <Label className="text-xs uppercase text-muted-foreground font-semibold mb-3 block">Company Logo (Optional)</Label>
                                <div className="flex items-center gap-4">
                                    {formData.logoUrl ? (
                                        <div className="relative group shrink-0">
                                            <img
                                                src={formData.logoUrl}
                                                alt="Logo"
                                                className="h-20 max-w-[120px] rounded-lg object-contain border border-slate-200 shadow-sm p-2 bg-slate-50"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleChange('logoUrl', '')}
                                                className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-600 z-10"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="h-20 w-20 rounded-lg bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                                            <ImagePlus className="h-6 w-6 text-slate-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="hidden"
                                            />
                                            <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                                                {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                                            </div>
                                        </label>
                                        <p className="text-[10px] text-muted-foreground">Or paste a URL. Leave empty for the default UXDLab logo.</p>
                                        <Input
                                            value={formData.logoUrl || ''}
                                            onChange={e => handleChange('logoUrl', e.target.value)}
                                            placeholder="https://example.com/logo.png"
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Name & Designation */}
                            <div className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
                                <Label className="text-xs uppercase text-muted-foreground font-semibold">Personal Details</Label>
                                <div className="grid gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Full Name *</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => handleChange('name', e.target.value)}
                                            placeholder="e.g. Kashish Yadav"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Designation</Label>
                                        <Input
                                            value={formData.designation}
                                            onChange={e => handleChange('designation', e.target.value)}
                                            placeholder="e.g. Business Development Executive"
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Contact Details */}
                            <div className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
                                <Label className="text-xs uppercase text-muted-foreground font-semibold">Contact Information</Label>
                                <div className="grid gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Phone (T:)</Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => handleChange('phone', e.target.value)}
                                            placeholder="e.g. +91 9871120215"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Mobile (M:)</Label>
                                        <Input
                                            value={formData.mobile}
                                            onChange={e => handleChange('mobile', e.target.value)}
                                            placeholder="e.g. +1 2082930140"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Website (W:)</Label>
                                        <Input
                                            value={formData.website}
                                            onChange={e => handleChange('website', e.target.value)}
                                            placeholder="e.g. www.uxdlab.com"
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Live Mini Preview */}
                            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                <div className="px-4 py-2 bg-slate-50 border-b flex items-center justify-between">
                                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Live Preview</span>
                                    <span className="text-[10px] text-muted-foreground">Updates as you type</span>
                                </div>
                                <div className="p-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t pt-4 px-4 bg-white pb-6 flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-9 text-xs"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !formData.name.trim()}
                        className="h-9 gap-1.5 px-6 shadow-md"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {saving ? 'Saving...' : 'Save Signature'}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}
