import { useState, useRef } from "react"
import { Button } from "src/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "src/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "src/components/ui/table"
import { FileUp, Loader2, Download, CheckCircle2 } from "lucide-react"
import * as XLSX from "xlsx"
import { employeeService } from "src/firebase/employeeService"
import { toast } from "sonner"
import { Badge } from "src/components/ui/badge"

interface ImportEmployeesDialogProps {
    onImportComplete?: () => void
}

export function ImportEmployeesDialog({ onImportComplete }: ImportEmployeesDialogProps) {
    const [open, setOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const [data, setData] = useState<any[]>([])
    const [fileName, setFileName] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (evt) => {
            const data = evt.target?.result
            const wb = XLSX.read(data, { type: "array" })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            const json = XLSX.utils.sheet_to_json(ws)
            setData(json)
        }
        reader.readAsArrayBuffer(file)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (!file || !(file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
            toast.error("Please upload an Excel or CSV file")
            return
        }

        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (evt) => {
            const data = evt.target?.result
            const wb = XLSX.read(data, { type: "array" })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            const json = XLSX.utils.sheet_to_json(ws)
            setData(json)
        }
        reader.readAsArrayBuffer(file)
    }

    const downloadTemplate = (format: 'xlsx' | 'csv') => {
        const template = [
            {
                Name: "John Doe",
                Email: "john@example.com",
                Role: "Designer",
                Department: "Design",
                Team: "Design Team",
                Phone: "1234567890",
                Location: "Remote",
                JoiningDate: "2024-01-01",
                DateOfBirth: "1990-01-01"
            }
        ]
        const ws = XLSX.utils.json_to_sheet(template)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Employees")

        if (format === 'xlsx') {
            XLSX.writeFile(wb, "employee_import_template.xlsx")
        } else {
            XLSX.writeFile(wb, "employee_import_template.csv", { bookType: 'csv' })
        }
    }

    const handleImport = async () => {
        if (data.length === 0) return

        setImporting(true)
        let successCount = 0
        let errorCount = 0

        try {
            for (const item of data) {
                try {
                    // Normalize keys to lowercase for flexible matching
                    const normalizedItem: any = {}
                    Object.keys(item).forEach(key => {
                        normalizedItem[key.toLowerCase().replace(/\s+/g, '')] = item[key]
                    })

                    const name = normalizedItem.name || normalizedItem.fullname || normalizedItem.employeename
                    const email = normalizedItem.email || normalizedItem.emailaddress

                    // Only Name is strictly required now
                    if (!name) {
                        console.warn("Skipping row: missing name", item)
                        errorCount++
                        continue
                    }

                    let cleanEmail = email ? String(email).toLowerCase().trim() : "";

                    if (!cleanEmail) {
                        // Generate a professional email if missing
                        const formattedName = String(name)
                            .toLowerCase()
                            .trim()
                            .replace(/[^a-z0-9]/g, '.') // Replace non-alphanumeric with dots
                            .replace(/\.{2,}/g, '.')    // Collapse multiple dots
                            .replace(/^\.|\.$/g, '');   // Trim dots from ends

                        cleanEmail = `${formattedName}@uxdlab.com`;
                    }

                    // Check if email exists
                    const exists = await employeeService.checkEmailExists(cleanEmail)
                    if (exists) {
                        console.warn(`Skipping row: email ${cleanEmail} already exists`)
                        errorCount++
                        continue
                    }

                    // Add employee
                    await employeeService.addEmployee({
                        name: String(name).trim(),
                        email: cleanEmail,
                        role: normalizedItem.role || normalizedItem.jobtitle || "Team Member",
                        department: normalizedItem.department || normalizedItem.dept || "Other",
                        team: normalizedItem.team || normalizedItem.group || "",
                        phone: normalizedItem.phone || normalizedItem.phonenumber || "",
                        location: normalizedItem.location || normalizedItem.city || "Remote",
                        status: "Active",
                        isOnLeave: false,
                        projectIds: [],
                        password: "Password123!", // Default password
                        lastActive: "Just now",
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        joiningDate: normalizedItem.joiningdate || normalizedItem.doj || "",
                        dateOfBirth: normalizedItem.dateofbirth || normalizedItem.dob || "",
                    } as any)
                    successCount++
                } catch (err) {
                    console.error("Error importing row:", err)
                    errorCount++
                }
            }

            toast.success(`Import complete: ${successCount} success, ${errorCount} failed`)
            if (successCount > 0) {
                setOpen(false)
                setData([])
                setFileName(null)
                if (onImportComplete) onImportComplete()
            }
        } catch (error) {
            console.error("Import error:", error)
            toast.error("Failed to complete import")
        } finally {
            setImporting(false)
        }
    }

    const reset = () => {
        setData([])
        setFileName(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val)
            if (!val) reset()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <FileUp className="h-4 w-4" />
                    Import Employees
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>Import Employees</DialogTitle>
                    <DialogDescription>
                        Upload an Excel (.xlsx, .xls) or CSV file to import multiple employees at once.
                        Download a template to see the required format.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="relative"
                                disabled={importing}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileChange}
                                />
                                Choose File
                            </Button>
                            {fileName && (
                                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    {fileName}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => downloadTemplate('xlsx')} className="gap-2">
                                <Download className="h-4 w-4" />
                                Excel Template
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => downloadTemplate('csv')} className="gap-2">
                                <Download className="h-4 w-4" />
                                CSV Template
                            </Button>
                        </div>
                    </div>

                    {data.length > 0 ? (
                        <div className="border rounded-md flex-1 overflow-auto relative">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Team</TableHead>
                                        <TableHead>Joining Date</TableHead>
                                        <TableHead>DOB</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item, idx) => {
                                        const normalized: any = {}
                                        Object.keys(item).forEach(key => {
                                            normalized[key.toLowerCase().replace(/\s+/g, '')] = item[key]
                                        })

                                        const name = normalized.name || normalized.fullname || normalized.employeename
                                        const email = normalized.email || normalized.emailaddress

                                        return (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium">
                                                    {name ? String(name) : <span className="text-destructive font-bold text-[10px] uppercase tracking-wider">Required Field Missing</span>}
                                                </TableCell>
                                                <TableCell>
                                                    {email ? (
                                                        String(email)
                                                    ) : name ? (
                                                        <span className="text-amber-500 font-medium text-[10px] uppercase tracking-wider flex items-center gap-1">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                            Auto-Generated
                                                        </span>
                                                    ) : (
                                                        <span className="text-destructive font-bold text-[10px] uppercase tracking-wider">Required Field Missing</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-500 font-medium">{normalized.role || normalized.jobtitle || "Team Member"}</TableCell>
                                                <TableCell className="text-slate-500">{normalized.department || normalized.dept || "Other"}</TableCell>
                                                <TableCell>
                                                    {(normalized.team || normalized.group) ? (
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none">
                                                            {normalized.team || normalized.group}
                                                        </Badge>
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell className="text-slate-500 text-xs">{normalized.joiningdate || normalized.doj || "-"}</TableCell>
                                                <TableCell className="text-slate-500 text-xs">{normalized.dateofbirth || normalized.dob || "-"}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div
                            className={`flex-1 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center space-y-4 p-12 transition-all duration-300 ${isDragging ? 'bg-primary/5 border-primary shadow-inner scale-[0.98]' : 'bg-muted/30 border-muted-foreground/20'}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className={`h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-primary text-white scale-110' : 'bg-primary/10 text-primary'}`}>
                                <FileUp className={`h-8 w-8 ${isDragging ? 'animate-bounce' : ''}`} />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="font-bold text-lg">
                                    {isDragging ? 'Drop to upload' : 'Ready to import?'}
                                </p>
                                <p className="text-sm text-muted-foreground max-w-[240px]">
                                    {isDragging ? 'Release the file to start processing' : 'Drag & drop your Excel or CSV file here or click to choose'}
                                </p>
                            </div>
                            {!isDragging && (
                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="rounded-full px-8"
                                >
                                    Select File
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-0 mt-auto">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={importing || data.length === 0}
                        className="min-w-[120px]"
                    >
                        {importing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>Import {data.length} Employees</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
