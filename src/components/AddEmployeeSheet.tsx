import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Plus, Save, Loader2, Upload, X, Eye, EyeOff, Check, ChevronsUpDown, KeyRound, Mail } from "lucide-react"
import { employeeService } from "src/firebase/employeeService"
import { settingsService } from "src/firebase/settingsService"
import type { Employee } from "src/store/slices/employeesSlice"
import { storage } from "src/firebase/config"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { toast } from "sonner"

interface AddEmployeeSheetProps {
    employeeToEdit?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export function AddEmployeeSheet({ employeeToEdit, open: controlledOpen, onOpenChange: setControlledOpen, trigger }: AddEmployeeSheetProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const setOpen = setControlledOpen || setInternalOpen

    const [loading, setLoading] = useState(false)
    const [photo, setPhoto] = useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Team Dropdown State
    const [teams, setTeams] = useState<string[]>([])
    const [searchTeam, setSearchTeam] = useState("")
    const [openTeam, setOpenTeam] = useState(false)
    const [isAddTeamOpen, setIsAddTeamOpen] = useState(false)
    const [newTeamName, setNewTeamName] = useState("")
    const [isAddingTeam, setIsAddingTeam] = useState(false)

    // Subscribe to teams
    useEffect(() => {
        const unsubscribe = settingsService.subscribeToTeams((list) => {
            setTeams(list)
        })
        return () => unsubscribe()
    }, [])

    const handleTeamChange = (currentValue: string) => {
        handleChange("team", currentValue === formData.team ? "" : currentValue)
        setOpenTeam(false)
    }

    const handleManualAddTeam = async () => {
        if (!newTeamName.trim()) return

        setIsAddingTeam(true)
        try {
            await settingsService.addTeam(newTeamName.trim())

            // Update form data with new team immediately
            setFormData(prev => ({
                ...prev,
                team: newTeamName.trim()
            }))

            setIsAddTeamOpen(false)
            setNewTeamName("")
            toast.success("New team added")
        } catch (error) {
            console.error("Error adding team:", error)
            toast.error("Failed to add team")
        } finally {
            setIsAddingTeam(false)
        }
    }

    const [formData, setFormData] = useState<Partial<Employee>>({
        name: "",
        role: "",
        email: "",
        department: "",
        team: "",
        location: "",
        status: "Active",
        isOnLeave: false,
        projectIds: [],
        bdEmail: "",
        joiningDate: "",
        dateOfBirth: "",
        employmentType: "Full Time"
    })

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [appPassword, setAppPassword] = useState("")
    const [showAppPassword, setShowAppPassword] = useState(false)

    useEffect(() => {
        if (open) {
            if (employeeToEdit) {
                setFormData({
                    ...employeeToEdit,
                    projectIds: employeeToEdit.projectIds || [],
                    bdEmail: employeeToEdit.bdEmail || ""
                })
                if (employeeToEdit.avatar) {
                    setAvatarPreview(employeeToEdit.avatar)
                }
                setAppPassword(employeeToEdit.appPassword || "")
            } else {
                resetForm()
            }
        }
    }, [open, employeeToEdit])

    const handleChange = (field: keyof Employee, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setPhoto(file)
            setAvatarPreview(URL.createObjectURL(file))
        }
    }

    const removePhoto = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setPhoto(null)
        setAvatarPreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }



    const validateStep1 = (): boolean => {
        const errors: string[] = []

        // Required field validations
        if (!formData.name?.trim()) {
            errors.push("Full name is required")
        }

        if (!formData.role?.trim()) {
            errors.push("Role/Job title is required")
        }

        if (!formData.email?.trim()) {
            errors.push("Email is required")
        } else if (!validateEmail(formData.email)) {
            errors.push("Please enter a valid email address")
        }



        if (!formData.department?.trim()) {
            errors.push("Department is required")
        }
        
        if (!formData.employmentType) {
            errors.push("Employment type is required")
        }

        // Password validations for new employees
        if (!employeeToEdit) {
            if (!password) {
                errors.push("Password is required")
            } else if (password.length < 6) {
                errors.push("Password must be at least 6 characters")
            }

            if (!confirmPassword) {
                errors.push("Please confirm your password")
            } else if (password !== confirmPassword) {
                errors.push("Passwords do not match")
            }
        }

        // App Password validation for BDE department
        if (formData.department?.toLowerCase() === 'bde' && appPassword) {
            const cleaned = appPassword.replace(/\s/g, '')
            if (cleaned.length !== 16 || !/^[a-zA-Z]+$/.test(cleaned)) {
                errors.push("App Password must be 16 letters (e.g. xxxx xxxx xxxx xxxx)")
            }
        }

        // Show first error if any
        if (errors.length > 0) {
            toast.error(errors[0])
            return false
        }

        return true
    }

    const handleSubmit = async () => {
        // Re-validate step 1 just in case
        if (!validateStep1()) {
            return
        }

        setLoading(true)
        try {
            // Check for duplicate email
            const emailExists = await employeeService.checkEmailExists(
                formData.email!,
                employeeToEdit?.id
            )

            if (emailExists) {
                toast.error("An employee with this email address already exists")
                setLoading(false)
                return
            }

            let avatarUrl = avatarPreview || null;
            if (photo) {
                const storageRef = ref(storage, `avatars/${Date.now()}_${photo.name}`);
                await uploadBytes(storageRef, photo);
                avatarUrl = await getDownloadURL(storageRef);
            }

            // Sanitize data: only save fields that belong in the employee document
            const employeeData = {
                name: formData.name,
                role: formData.role,
                email: formData.email?.toLowerCase().trim(),
                department: formData.department,
                team: formData.team,
                location: formData.location,
                status: formData.status,
                isOnLeave: formData.isOnLeave,
                projectIds: formData.projectIds || [],
                avatar: avatarUrl,
                bdEmail: formData.bdEmail?.toLowerCase().trim() || "",
                joiningDate: formData.joiningDate || "",
                dateOfBirth: formData.dateOfBirth || "",
                appPassword: (formData.department?.toLowerCase() === 'bde' ? appPassword.replace(/\s/g, '') : ""),
                permittedDevices: formData.permittedDevices || 1,
                leaveDate: formData.leaveDate || null,
                leaveHistory: formData.leaveHistory || [],
                employmentType: formData.employmentType || "Full Time",
            };

            if (employeeToEdit && employeeToEdit.id) {
                await employeeService.updateEmployee(employeeToEdit.id, employeeData)
            } else {
                await employeeService.addEmployee({
                    ...employeeData,
                    password,
                    lastActive: "Just now",
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                } as any)
            }

            setOpen(false)
            resetForm()
            toast.success(employeeToEdit ? "Employee updated successfully" : "Employee added successfully")
        } catch (error) {
            console.error("Error saving employee:", error)
            toast.error(error instanceof Error ? error.message : "Failed to save employee")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setFormData({
            name: "",
            role: "",
            email: "",
            department: "",
            team: "",
            location: "",
            status: "Active",
            isOnLeave: false,
            projectIds: [],
            bdEmail: "",
            joiningDate: "",
            dateOfBirth: "",
            employmentType: "Full Time"
        })
        setPhoto(null)
        setAvatarPreview(null)
        setAppPassword("")
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            {trigger !== null && (
                <SheetTrigger asChild>
                    {trigger ? trigger : (
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" /> Add Employee
                        </Button>
                    )}
                </SheetTrigger>
            )}
            <SheetContent className="overflow-y-auto w-full sm:max-w-[600px] flex flex-col">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">Creating Employee...</p>
                    </div>
                )}

                <SheetHeader>
                    <SheetTitle>{employeeToEdit ? "Edit Employee" : "Add Employee"}</SheetTitle>
                    <SheetDescription>
                        {employeeToEdit
                            ? "Update employee information."
                            : "Add a new employee to your organization."}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 py-4">
                    <div className="grid gap-4">
                        <div className="flex flex-col items-center gap-4 mt-2 mb-4">
                            <div className="relative">
                                <Label htmlFor="photo-upload" className="cursor-pointer group relative block">
                                    <div className="h-28 w-28 rounded-full border-2 border-dashed border-muted-foreground/25 flex items-center justify-center hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 overflow-hidden bg-background">
                                        {avatarPreview ? (
                                            <img
                                                src={avatarPreview}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <Plus className="h-10 w-10 text-muted-foreground/40 group-hover:text-primary group-hover:scale-110 transition-all duration-200" />
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Upload className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <Input
                                        id="photo-upload"
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                    />
                                </Label>

                                {avatarPreview && (
                                    <button
                                        type="button"
                                        onClick={removePhoto}
                                        className="absolute top-0 right-0 p-1 bg-destructive text-destructive-foreground rounded-full shadow-sm hover:bg-destructive/90 transition-colors z-20"
                                        title="Remove photo"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Upload Profile Photo</span>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                placeholder="Jane Doe"
                                value={formData.name}
                                onChange={(e) => handleChange("name", e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="role">Role / Job Title</Label>
                            <Input
                                id="role"
                                placeholder="Senior Designer"
                                value={formData.role}
                                onChange={(e) => handleChange("role", e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="jane@uxdlab.com"
                                value={formData.email}
                                onChange={(e) => handleChange("email", e.target.value)}
                            />
                        </div>

                        {!employeeToEdit && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2 relative">
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="******"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-2 relative">
                                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="******"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="department">Department</Label>
                                <Select
                                    value={formData.department}
                                    onValueChange={(val) => handleChange("department", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select dept." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Design">Design</SelectItem>
                                        <SelectItem value="Engineering">Engineering</SelectItem>
                                        <SelectItem value="Product">Product</SelectItem>
                                        <SelectItem value="Marketing">Marketing</SelectItem>
                                        <SelectItem value="Email Marketing">Email Marketing</SelectItem>
                                        <SelectItem value="BDE">BDE</SelectItem>
                                        <SelectItem value="Sales">Sales</SelectItem>
                                        <SelectItem value="HR">HR</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(val) => handleChange("status", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Probation">Probation</SelectItem>
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="team">Team</Label>
                                <Popover open={openTeam} onOpenChange={setOpenTeam}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openTeam}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formData.team
                                                ? formData.team
                                                : "Select team..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[200px] p-0">
                                        <Command>
                                            <CommandInput
                                                placeholder="Search team..."
                                                value={searchTeam}
                                                onValueChange={setSearchTeam}
                                            />
                                            <CommandEmpty>
                                                <p className="text-sm text-muted-foreground p-2 text-center">No team found.</p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start text-xs h-8"
                                                    onClick={() => {
                                                        setNewTeamName(searchTeam)
                                                        setIsAddTeamOpen(true)
                                                        setOpenTeam(false)
                                                    }}
                                                >
                                                    <Plus className="mr-2 h-3 w-3" />
                                                    Add "{searchTeam}"
                                                </Button>
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {teams.map((team) => (
                                                    <CommandItem
                                                        key={team}
                                                        value={team}
                                                        onSelect={() => handleTeamChange(team)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.team === team ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {team}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="location">Location</Label>
                                <Input
                                    id="location"
                                    placeholder="Remote / New York, NY"
                                    value={formData.location}
                                    onChange={(e) => handleChange("location", e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="employmentType">Employment Type</Label>
                            <Select
                                value={formData.employmentType}
                                onValueChange={(val) => handleChange("employmentType", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employment type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Full Time">Full Time</SelectItem>
                                    <SelectItem value="Internship (Paid)">Internship (Paid)</SelectItem>
                                    <SelectItem value="Internship (Unpaid)">Internship (Unpaid)</SelectItem>
                                    <SelectItem value="Internship (Hybrid)">Internship (Hybrid)</SelectItem>
                                    <SelectItem value="Left">Left</SelectItem>

                                </SelectContent>
                            </Select>
                        </div>

                        {/* App Password for BDE */}
                        {formData.department?.toLowerCase() === 'bde' && (
                            <div className="grid gap-2 p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl">
                                <div className="flex items-center gap-2 mb-1">
                                    <KeyRound className="h-4 w-4 text-amber-600" />
                                    <Label htmlFor="appPassword" className="text-sm font-bold text-amber-800">Google App Password</Label>
                                </div>
                                <p className="text-[11px] text-amber-600/80 -mt-1 mb-2">
                                    Required to send lead emails from this employee's Gmail account.
                                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="ml-1 underline font-semibold hover:text-amber-800 transition-colors">Generate one here →</a>
                                </p>
                                <div className="relative">
                                    <Input
                                        id="appPassword"
                                        type={showAppPassword ? "text" : "password"}
                                        placeholder="xxxx xxxx xxxx xxxx"
                                        value={appPassword}
                                        onChange={(e) => setAppPassword(e.target.value)}
                                        className="pr-10 font-mono tracking-wider bg-white"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowAppPassword(!showAppPassword)}
                                    >
                                        {showAppPassword ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                                {appPassword && (() => {
                                    const cleaned = appPassword.replace(/\s/g, '')
                                    const isValid = cleaned.length === 16 && /^[a-zA-Z]+$/.test(cleaned)
                                    return (
                                        <p className={`text-[11px] font-semibold mt-1 ${isValid ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {isValid ? '✓ Valid App Password format' : `✗ Must be 16 letters (${cleaned.length}/16)`}
                                        </p>
                                    )
                                })()}
                            </div>
                        )}

                        {/* BD Email for BDE */}
                        {formData.department?.toLowerCase() === 'bde' && (
                            <div className="grid gap-2 p-4 bg-sky-50/50 border border-sky-200/60 rounded-xl">
                                <div className="flex items-center gap-2 mb-1">
                                    <Mail className="h-4 w-4 text-sky-600" />
                                    <Label htmlFor="bdEmail" className="text-sm font-bold text-sky-800">Sender Email (Optional)</Label>
                                </div>
                                <p className="text-[11px] text-sky-600/80 -mt-1 mb-2">
                                    Leave empty to use the official employee email ({formData.email || "jane@uxdlab.com"}).
                                </p>
                                <Input
                                    id="bdEmail"
                                    type="email"
                                    placeholder="e.g. outreach@uxdlab.com"
                                    value={formData.bdEmail}
                                    onChange={(e) => handleChange("bdEmail", e.target.value)}
                                    className="bg-white border-sky-200 focus:border-sky-400 focus:ring-sky-400"
                                />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="joiningDate">Joining Date</Label>
                                <Input
                                    id="joiningDate"
                                    type="date"
                                    value={formData.joiningDate}
                                    onChange={(e) => handleChange("joiningDate", e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                                <Input
                                    id="dateOfBirth"
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <SheetFooter className="flex items-center justify-end gap-2 sm:space-x-0 mt-auto">
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {employeeToEdit ? "Update Employee" : "Save Employee"}
                    </Button>
                </SheetFooter>
                <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Team</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-team" className="text-right">Team Name</Label>
                                <Input
                                    id="new-team"
                                    placeholder="e.g. Design System"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsAddTeamOpen(false)}>Cancel</Button>
                                <Button onClick={handleManualAddTeam} disabled={isAddingTeam || !newTeamName.trim()}>
                                    {isAddingTeam && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Team
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </SheetContent>
        </Sheet >
    )
}
