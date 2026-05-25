import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
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
import { Plus, Save, Loader2, Check, ChevronsUpDown } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { clientService } from "src/firebase/clientService"
import { useClients } from "src/hooks/useClients"
import type { Client } from "src/store/slices/clientsSlice"
import { cn } from "@/lib/utils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { settingsService } from "src/firebase/settingsService"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

interface AddClientSheetProps {
    clientToEdit?: Client
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export function AddClientSheet({ clientToEdit, open: controlledOpen, onOpenChange: setControlledOpen, trigger }: AddClientSheetProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen

    const { clients } = useClients()
    const [loading, setLoading] = useState(false)

    const [sendInvite, setSendInvite] = useState(true)

    // Location State
    const [countries, setCountries] = useState<any[]>([])
    const [isLoadingCountries, setIsLoadingCountries] = useState(false)
    const [selectedCountry, setSelectedCountry] = useState("")
    const [selectedCity, setSelectedCity] = useState("")
    const [openCountry, setOpenCountry] = useState(false)
    const [openCity, setOpenCity] = useState(false)
    const [searchCountry, setSearchCountry] = useState("")
    const [searchCity, setSearchCity] = useState("")
    const [openIndustry, setOpenIndustry] = useState(false)
    const [searchIndustry, setSearchIndustry] = useState("")
    const [industries, setIndustries] = useState<string[]>([])

    // New Industry Dialog State
    const [isAddIndustryOpen, setIsAddIndustryOpen] = useState(false)
    const [newIndustryName, setNewIndustryName] = useState("")
    const [isAddingIndustry, setIsAddingIndustry] = useState(false)

    const [formData, setFormData] = useState<Partial<Client>>({
        name: "",
        company: "",
        email: "",
        phone: "",
        industry: "",
        location: "",
        status: "Active",
        projects: []
    })

    useEffect(() => {
        const unsubscribe = settingsService.subscribeToIndustries((list) => {
            setIndustries(list)
        })
        return () => unsubscribe()
    }, [])

    // Fetch countries
    useEffect(() => {
        const fetchCountries = async () => {
            if (countries.length > 0) return;
            setIsLoadingCountries(true)
            try {
                const response = await fetch('https://countriesnow.space/api/v0.1/countries')
                const data = await response.json()
                if (!data.error) {
                    setCountries(data.data)
                }
            } catch (error) {
                console.error("Failed to fetch countries:", error)
            } finally {
                setIsLoadingCountries(false)
            }
        }

        if (open) {
            fetchCountries()
        }
    }, [open])

    // Populate form if editing
    useEffect(() => {
        if (open) {
            if (clientToEdit) {
                setFormData(clientToEdit)
                setSendInvite(false)
                // Parse location "City, Country"
                if (clientToEdit.location && clientToEdit.location.includes(",")) {
                    const parts = clientToEdit.location.split(",").map(s => s.trim())
                    if (parts.length >= 2) {
                        // Assuming Format "City, Country"
                        const country = parts[parts.length - 1]
                        const city = parts.slice(0, parts.length - 1).join(", ")
                        setSelectedCountry(country)
                        setSelectedCity(city)
                    } else {
                        setSelectedCountry("")
                        setSelectedCity("")
                    }
                } else {
                    setSelectedCountry("")
                    setSelectedCity("")
                }
            } else {
                resetForm()
                setSendInvite(true)
            }
        }
    }, [open, clientToEdit])

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        const length = 12
        let pwd = ""
        for (let i = 0; i < length; i++) {
            pwd += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return pwd
    }


    const handleChange = (field: keyof Client, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleCountryChange = (country: string) => {
        setSelectedCountry(country)
        setSelectedCity("")
        handleChange("location", country)
    }

    const handleCityChange = (city: string) => {
        setSelectedCity(city)
        handleChange("location", `${city}, ${selectedCountry}`)
    }

    const handleIndustryChange = (currentValue: string) => {
        handleChange("industry", currentValue)
        setOpenIndustry(false)
    }

    const handleManualAddIndustry = async () => {
        if (!newIndustryName.trim()) return

        setIsAddingIndustry(true)
        try {
            await settingsService.addIndustry(newIndustryName.trim())
            handleChange("industry", newIndustryName.trim())
            setIsAddIndustryOpen(false)
            setNewIndustryName("")
        } catch (error) {
            console.error("Failed to add industry", error)
        } finally {
            setIsAddingIndustry(false)
        }
    }

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    const validatePhone = (phone: string): boolean => {
        // Allow formats: +1 (555) 000-0000, +1-555-000-0000, 5550000000, etc.
        const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{3,6}$/
        return phone.trim() === "" || phoneRegex.test(phone.replace(/\s/g, ""))
    }

    const handleSubmit = async () => {
        // Validation
        const errors: string[] = []

        // Required field validations
        if (!formData.name?.trim()) {
            errors.push("Client name is required")
        }

        if (!formData.company?.trim()) {
            errors.push("Company name is required")
        }

        if (!formData.email?.trim()) {
            errors.push("Email is required")
        } else if (!validateEmail(formData.email)) {
            errors.push("Please enter a valid email address")
        }

        if (formData.phone && !validatePhone(formData.phone)) {
            errors.push("Please enter a valid phone number")
        }

        if (!formData.industry?.trim()) {
            errors.push("Industry is required")
        }

        // Password validations removed for auto-generation

        // Show first error if any
        if (errors.length > 0) {
            toast.error(errors[0])
            return
        }

        setLoading(true)
        try {
            // Check for duplicate email completely in-memory (0ms network cost)
            const submissionEmail = formData.email!.toLowerCase().trim()
            const emailExists = clients.some(c => 
                c.email.toLowerCase().trim() === submissionEmail && 
                c.id !== clientToEdit?.id
            )

            if (emailExists) {
                toast.error("A client with this email address already exists")
                setLoading(false)
                return
            }

            if (clientToEdit && clientToEdit.id) {
                const password = sendInvite ? generatePassword() : undefined;
                await clientService.updateClient(clientToEdit.id, {
                    ...formData,
                    email: formData.email?.toLowerCase().trim(),
                    ...(password && { password })
                })
            } else {
                const password = sendInvite ? generatePassword() : undefined;
                await clientService.addClient({
                    ...formData,
                    email: formData.email?.toLowerCase().trim(),
                    password,
                    projects: [],
                    lastSeen: new Date().toISOString()
                } as any)
            }

            setOpen(false)
            toast.success(clientToEdit ? "Client updated successfully" : "Client added successfully")
        } catch (error) {
            console.error("Error saving client:", error)
            toast.error(error instanceof Error ? error.message : "Failed to save client")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setFormData({
            name: "",
            company: "",
            email: "",
            phone: "",
            industry: "",
            location: "",
            status: "Active",
            projects: []
        })
        setSelectedCountry("")
        setSelectedCity("")
        setSearchCountry("")
        setSearchCity("")
        setSendInvite(true)
    }

    // Filtered lists logic
    const filteredCountries = countries
        .filter(c => c.country.toLowerCase().includes(searchCountry.toLowerCase()))
        .slice(0, 50)

    const availableCities = countries.find(c => c.country === selectedCountry)?.cities || []

    const filteredCities = availableCities
        .filter((city: string) => city.toLowerCase().includes(searchCity.toLowerCase()))
        .slice(0, 50)

    const filteredIndustries = industries.filter((industry) =>
        industry.toLowerCase().includes(searchIndustry.toLowerCase())
    )

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            {trigger !== null && (
                <SheetTrigger asChild>
                    {trigger ? trigger : (
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" /> Add Client
                        </Button>
                    )}
                </SheetTrigger>
            )}
            <SheetContent className="overflow-y-auto w-full sm:max-w-[600px] flex flex-col">
                {loading && (
                    <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">
                            {clientToEdit ? "Updating Client..." : "Creating Client..."}
                        </p>
                    </div>
                )}

                <SheetHeader>
                    <SheetTitle>{clientToEdit ? "Edit Client" : "Add Client"}</SheetTitle>
                    <SheetDescription>
                        {clientToEdit ? "Update client details." : "Add a new client to your CRM."}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 py-4">
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Client Name</Label>
                            <Input
                                id="name"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => handleChange("name", e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="company">Company</Label>
                            <Input
                                id="company"
                                placeholder="Acme Inc"
                                value={formData.company}
                                onChange={(e) => handleChange("company", e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    value={formData.email}
                                    onChange={(e) => handleChange("email", e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    placeholder="+1 (555) 000-0000"
                                    value={formData.phone}
                                    onChange={(e) => handleChange("phone", e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">
                                    {clientToEdit ? "Reset Password & Send Email" : "Send Invitation"}
                                </Label>
                                <div className="text-sm text-muted-foreground">
                                    {clientToEdit
                                        ? "Helper text: Will generate a new password and email it to the client."
                                        : "Client will receive an email with their login credentials."}
                                </div>
                            </div>
                            <Switch
                                checked={sendInvite}
                                onCheckedChange={setSendInvite}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="industry">Industry</Label>
                                <div className="flex gap-2">
                                    <Popover open={openIndustry} onOpenChange={setOpenIndustry}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openIndustry}
                                                className="w-full justify-between"
                                            >
                                                {formData.industry
                                                    ? formData.industry
                                                    : "Select industry..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command shouldFilter={false}>
                                                <CommandInput
                                                    placeholder="Search industry..."
                                                    value={searchIndustry}
                                                    onValueChange={setSearchIndustry}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No industry found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredIndustries.map((industry) => (
                                                            <CommandItem
                                                                key={industry}
                                                                value={industry}
                                                                onSelect={() => handleIndustryChange(industry)}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        formData.industry === industry ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {industry}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <Dialog open={isAddIndustryOpen} onOpenChange={setIsAddIndustryOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="icon" title="Add new industry">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Add New Industry</DialogTitle>
                                                <DialogDescription>
                                                    Create a new industry to add to the global list.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="new-industry">Name</Label>
                                                    <Input
                                                        id="new-industry"
                                                        value={newIndustryName}
                                                        onChange={(e) => setNewIndustryName(e.target.value)}
                                                        placeholder="e.g. Aerospace"
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsAddIndustryOpen(false)}>Cancel</Button>
                                                <Button onClick={handleManualAddIndustry} disabled={isAddingIndustry || !newIndustryName.trim()}>
                                                    {isAddingIndustry && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Save
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
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
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Location Section */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="country">Country</Label>
                                <Popover open={openCountry} onOpenChange={setOpenCountry}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCountry}
                                            className="w-full justify-between"
                                            disabled={isLoadingCountries}
                                        >
                                            {selectedCountry
                                                ? selectedCountry
                                                : isLoadingCountries ? "Loading..." : "Select country..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command shouldFilter={false}>
                                            <CommandInput
                                                placeholder="Search country..."
                                                value={searchCountry}
                                                onValueChange={setSearchCountry}
                                            />
                                            <CommandList className="max-h-[200px] overflow-y-auto">
                                                <CommandEmpty>No country found.</CommandEmpty>
                                                <CommandGroup>
                                                    {filteredCountries.map((c) => (
                                                        <CommandItem
                                                            key={c.iso2 || c.country}
                                                            value={c.country}
                                                            onSelect={() => {
                                                                handleCountryChange(c.country)
                                                                setOpenCountry(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedCountry === c.country ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {c.country}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="city">City</Label>
                                <Popover open={openCity} onOpenChange={setOpenCity}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCity}
                                            className="w-full justify-between"
                                            disabled={!selectedCountry}
                                        >
                                            {selectedCity
                                                ? selectedCity
                                                : "Select city..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command shouldFilter={false}>
                                            <CommandInput
                                                placeholder="Search city..."
                                                value={searchCity}
                                                onValueChange={setSearchCity}
                                            />
                                            <CommandList className="max-h-[200px] overflow-y-auto">
                                                <CommandEmpty>No city found.</CommandEmpty>
                                                <CommandGroup>
                                                    {filteredCities.map((city: string) => (
                                                        <CommandItem
                                                            key={city}
                                                            value={city}
                                                            onSelect={() => {
                                                                handleCityChange(city)
                                                                setOpenCity(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedCity === city ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {city}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                </div>

                <SheetFooter className="flex items-center justify-end gap-2 sm:space-x-0 mt-auto">
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {clientToEdit ? "Update Client" : "Save Client"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
