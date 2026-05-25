import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { formatInTimeZone, toDate } from "date-fns-tz"
import cityTimezones from "city-timezones"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { CalendarDays, Clock, Video, Loader2, Send, X, Check, Plus, Globe } from "lucide-react"
import { projectService } from "src/firebase/projectService"
import { useClients } from "src/hooks/useClients"
import { useAuth } from "src/contexts/AuthContext"
import { useEmployees } from "src/hooks/useEmployees"
import type { Project } from "src/store/slices/projectsSlice"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface ScheduleMeetingSheetProps {
    project: Project
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ScheduleMeetingSheet({ project, open, onOpenChange }: ScheduleMeetingSheetProps) {
    const { user } = useAuth()
    const { employees } = useEmployees()
    const { clients } = useClients()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        date: "",
        time: "",
        title: `Meeting: ${project.name}`,
        link: "",
        notes: "",
        clientEmail: "",
        attendees: [] as string[], // Employee IDs
        timezoneMode: 'noida' as 'noida' | 'client'
    })

    const foundClient = useMemo(() => {
        if (project.clientId) {
            const byId = clients.find(c => c.id === project.clientId);
            if (byId) return byId;
        }
        const normalize = (s: string) => s?.toLowerCase().trim() || "";
        return clients.find(c => normalize(c.name) === normalize(project.client) || normalize(c.email) === normalize(project.clientEmail || ""));
    }, [clients, project.clientId, project.client, project.clientEmail]);

    const inferredClientTZ = useMemo(() => {
        if (foundClient?.timezone) return foundClient.timezone;
        if (foundClient?.location) {
            const loc = foundClient.location.toLowerCase();
            // Manual overrides for robust fallback
            if (loc.includes('california') || loc.includes('los angeles') || loc.includes('san francisco') || loc.includes('san diego')) return 'America/Los_Angeles';
            if (loc.includes('new york') || loc.includes('ny') || loc.includes('boston') || loc.includes('miami')) return 'America/New_York';
            if (loc.includes('texas') || loc.includes('chicago') || loc.includes('dallas')) return 'America/Chicago';
            if (loc.includes('colorado') || loc.includes('denver')) return 'America/Denver';
            if (loc.includes('arizona') || loc.includes('phoenix')) return 'America/Phoenix';
            if (loc.includes('london') || loc.includes('united kingdom') || loc.includes('uk')) return 'Europe/London';
            if (loc.includes('india') || loc.includes('delhi')) return 'Asia/Kolkata';
            if (loc.includes('dubai') || loc.includes('uae') || loc.includes('united arab emirates')) return 'Asia/Dubai';
            if (loc.includes('sydney') || loc.includes('nsw') || loc.includes('australia')) return 'Australia/Sydney';

            // Try to lookup via city-timezones
            const parts = foundClient.location.split(',');
            const city = parts[0].trim();
            const matches = cityTimezones.lookupViaCity(city);
            if (matches && matches.length > 0) {
                return matches[0].timezone;
            }
        }
        return null; // Could not determine
    }, [foundClient]);

    const NOIDA_TZ = 'Asia/Kolkata';
    const hasClientLocation = !!foundClient?.location && !!inferredClientTZ;
    const clientTZ = hasClientLocation ? inferredClientTZ! : 'UTC';

    const getCalculatedTimes = () => {
        if (!formData.date || !formData.time) return null;

        try {
            // Parse local input as if it were in the selected zone
            const selectedZone = formData.timezoneMode === 'noida' ? NOIDA_TZ : clientTZ;
            const inputDateTimeStr = `${formData.date} ${formData.time}`;

            // This represents the absolute moment in time
            const zonedDate = toDate(inputDateTimeStr, { timeZone: selectedZone });

            return {
                noida: formatInTimeZone(zonedDate, NOIDA_TZ, 'h:mm a'),
                client: hasClientLocation ? formatInTimeZone(zonedDate, clientTZ, 'h:mm a') : 'No location found',
                fullISO: zonedDate.toISOString()
            };
        } catch (e) {
            return null;
        }
    };

    const times = getCalculatedTimes();

    // Simplified formData without the mock link
    useEffect(() => {
        if (open) {
            setFormData({
                date: format(new Date(), "yyyy-MM-dd"),
                time: "10:00",
                title: `Meeting: ${project.name}`,
                link: "", // No longer needed on open
                notes: "",
                clientEmail: foundClient?.email || "",
                attendees: [],
                timezoneMode: hasClientLocation ? 'noida' : 'noida'
            })
            if (!foundClient?.email) {
                toast.info("Could not automatically find client email. Please enter it manually.")
            }
        }
    }, [open, project, foundClient])

    const handleSubmit = async () => {
        if (!formData.date || !formData.time) {
            toast.error("Please fill in all required fields (Date and Time)")
            return
        }

        setLoading(true)
        try {

            // 1. Validate client email
            if (!formData.clientEmail || !formData.clientEmail.includes('@')) {
                toast.error("Please enter a valid client email address")
                setLoading(false)
                return
            }

            // 2. Combine date and time
            const times = getCalculatedTimes();
            if (!times) throw new Error("Invalid date/time conversion");
            const meetingISO = times.fullISO;

            // 3. Create ACTUAL Google Meet Link via Cloud Function
            toast.loading("Generating real Google Meet link...")
            const { meetLink } = await projectService.createGoogleMeet({
                summary: formData.title,
                description: formData.notes,
                start: meetingISO,
                end: new Date(new Date(meetingISO).getTime() + 60 * 60000).toISOString(), // Default 1 hour
            })
            toast.dismiss()

            if (!meetLink) {
                throw new Error("Failed to generate real meet link")
            }

            const newMeeting = {
                title: formData.title,
                date: meetingISO,
                meetLink: meetLink,
                notes: formData.notes,
                attendees: formData.attendees,
                status: 'Scheduled',
                createdAt: new Date().toISOString()
            }

            // Save meeting to subcollection
            const meetingId = await projectService.addMeeting(project.id!, newMeeting)

            // Update upcoming meeting pointer in root document
            await projectService.updateProject(project.id!, {
                upcomingMeeting: meetingISO
            })

            // 5. Send Email to Client with the REAL link
            const emailHtml = `
                <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
                    
                    <!-- Header with Google Meet SVG -->
                    <div style="background-color: #f8fafc; padding: 48px 32px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Google_Meet_icon_%282020%29.svg/512px-Google_Meet_icon_%282020%29.svg.png" width="48" height="48" alt="Google Meet Logo" style="display: block; margin: 0 auto 24px auto;" />
                        <h1 style="color: #0f172a; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.025em; line-height: 1.2;">Video Meeting Scheduled</h1>
                        <p style="color: #475569; font-size: 16px; margin: 12px 0 0 0; font-weight: 500;">Project: <span style="color: #0f172a; font-weight: 600;">${project.name}</span></p>
                    </div>

                    <!-- Meeting Details Body -->
                    <div style="padding: 40px 32px;">
                        
                        <!-- Date and Time Highlight -->
                        <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                            <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 15px;">
                                <span style="display: block; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Meeting Date</span>
                                <span style="display: block; color: #0f172a; font-size: 20px; font-weight: 800;">${new Date(meetingISO).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            
                            <div style="display: flex; gap: 24px;">
                                <div style="flex: 1; text-align: center; border-right: 1px solid #cbd5e1;">
                                    <span style="display: block; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Your Local Time (${hasClientLocation ? inferredClientTZ : 'Local'})</span>
                                    <span style="display: block; color: #2563eb; font-size: 18px; font-weight: 700;">${times.client}</span>
                                </div>
                                <div style="flex: 1; text-align: center;">
                                    <span style="display: block; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">UXDLab (IST)</span>
                                    <span style="display: block; color: #0f172a; font-size: 18px; font-weight: 700;">${times.noida}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Join Button -->
                        <div style="text-align: center; margin-bottom: 40px;">
                            <a href="${meetLink}" style="background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1);">
                                Join Google Meet
                            </a>
                            <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
                                Or copy link: <a href="${meetLink}" style="color: #2563eb; text-decoration: none;">${meetLink}</a>
                            </p>
                        </div>

                        <!-- Agenda / Notes -->
                        ${formData.notes ? `
                        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                            <h2 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                                <span style="background-color: #e0e7ff; color: #4f46e5; width: 24px; height: 24px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">📝</span>
                                Meeting Agenda & Notes
                            </h2>
                            <div style="color: #475569; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${formData.notes}</div>
                        </div>` : ''}

                        <!-- Reply Action Block -->
                        <div style="background: linear-gradient(145deg, #eff6ff, #e0e7ff); border-radius: 12px; padding: 28px 24px; text-align: center;">
                            <span style="display: inline-block; font-size: 24px; margin-bottom: 12px;">👋</span>
                             <h3 style="color: #1e3a8a; font-size: 17px; font-weight: 700; margin: 0 0 12px 0;">Please Confirm Your Attendance</h3>
                             <p style="color: #3b82f6; font-size: 15px; margin: 0; line-height: 1.5; font-weight: 500;">
                                 Reply directly to this email with <strong style="color: #1d4ed8; background: #dcdceb; padding: 2px 6px; border-radius: 4px;">"Available"</strong>,  <strong style="color: #1d4ed8; background: #dcdceb; padding: 2px 6px; border-radius: 4px;">"Reschedule"</strong>, or <strong style="color: #1d4ed8; background: #dcdceb; padding: 2px 6px; border-radius: 4px;">"Not Available"</strong>.
                             </p>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center;">
                        <img src="https://uxdlab.us/wp-content/uploads/2024/09/fav-black-e1726055102573.png" width="24" height="24" alt="UXDLab Logo" style="display: block; margin: 0 auto 12px auto; opacity: 0.5;" />
                        <p style="color: #94a3b8; font-size: 12px; margin: 0;">Automated by UXDLab CRM Studio</p>
                    </div>
                </div>
            `

            const defaultCC = "rajeev@uxdlab.us";
            const selectedAttendeeEmails = employees
                .filter(e => formData.attendees.includes(e.id || ''))
                .map(e => e.email);

            const ccList = [defaultCC, ...selectedAttendeeEmails].filter(Boolean).join(', ');

            const sendOptions: any = {
                to: formData.clientEmail,
                cc: ccList,
                subject: `New Meeting Scheduled: ${formData.title} [Ref: P-${project.id} M-${meetingId}]`,
                html: emailHtml
            }

            const currentEmployee = employees.find(e => e.authUid === user?.uid || e.email === user?.email)
            if (currentEmployee?.department?.toLowerCase() === 'bde' && currentEmployee?.appPassword) {
                sendOptions.senderEmail = currentEmployee.bdEmail || currentEmployee.email
                sendOptions.senderAppPassword = currentEmployee.appPassword
                sendOptions.senderDisplayName = currentEmployee.name || user?.displayName || user?.email || "UXDLab"
            }

            await projectService.sendEmail(sendOptions)

            toast.success("Meeting scheduled and real Google Meet link sent!")
            onOpenChange(false)
        } catch (error: any) {
            console.error("Failed to schedule meeting:", error)
            toast.error(error.message || "Failed to schedule meeting")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto w-full sm:max-w-[700px] flex flex-col">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-primary" />
                        Schedule New Meeting.
                    </SheetTitle>
                    <SheetDescription>
                        Set up a meeting with {project.client} for {project.name}.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 py-6 space-y-6">
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="meeting-title">Meeting Title</Label>
                            <Input
                                id="meeting-title"
                                value={formData.title}
                                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                placeholder="e.g. Design Review Sync"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="client-email">Client Email</Label>
                            <Input
                                id="client-email"
                                type="email"
                                value={formData.clientEmail}
                                onChange={(e) => setFormData(p => ({ ...p, clientEmail: e.target.value }))}
                                placeholder="client@example.com"
                            />
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Date & Time</Label>
                                <div className="flex bg-muted p-1 rounded-lg gap-1 border">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={formData.timezoneMode === 'noida' ? 'default' : 'ghost'}
                                        onClick={() => setFormData(p => ({ ...p, timezoneMode: 'noida' }))}
                                        className="h-7 text-[10px] px-2"
                                    >
                                        Noida (IST)
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={formData.timezoneMode === 'client' ? 'default' : 'ghost'}
                                        onClick={() => setFormData(p => ({ ...p, timezoneMode: 'client' }))}
                                        disabled={!hasClientLocation}
                                        className="h-7 text-[10px] px-2 flex gap-1 items-center"
                                    >
                                        <Globe className="h-3 w-3" />
                                        {hasClientLocation ? 'Client Time' : 'No Location Found'}
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="meeting-date" className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Date</Label>
                                    <div className="relative">
                                        <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        <Input
                                            id="meeting-date"
                                            type="date"
                                            className="pl-9 h-12 bg-white"
                                            value={formData.date}
                                            onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="meeting-time" className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                        Time ({formData.timezoneMode === 'noida' ? 'IST' : (hasClientLocation ? foundClient?.location : 'No Location Found')})
                                    </Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        <Input
                                            id="meeting-time"
                                            type="time"
                                            className="pl-9 h-12 bg-white"
                                            value={formData.time}
                                            onChange={(e) => setFormData(p => ({ ...p, time: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {times && (
                                <div className="flex gap-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50 text-xs mt-1">
                                    <div className="flex-1 flex gap-2 items-center">
                                        <div className="h-2 w-2 rounded-full bg-slate-400" />
                                        <span className="text-muted-foreground">Noida:</span>
                                        <span className="font-bold text-slate-900">{times.noida}</span>
                                    </div>
                                    <div className="flex-1 flex gap-2 items-center border-l pl-4 border-blue-100">
                                        <Globe className={cn("h-3 w-3", hasClientLocation ? "text-blue-500" : "text-muted-foreground/50")} />
                                        <span className="text-muted-foreground">Client ({hasClientLocation ? foundClient?.location : 'No Location'}):</span>
                                        <span className={cn("font-bold", hasClientLocation ? "text-blue-700" : "text-muted-foreground")}>{times.client}</span>
                                    </div>
                                </div>
                            )}
                        </div>



                        <div className="grid gap-2">
                            <Label htmlFor="meeting-notes">Agenda / Notes (Optional)</Label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {formData.attendees.map(attendeeId => {
                                    const employee = employees.find(e => e.id === attendeeId);
                                    if (!employee) return null;
                                    return (
                                        <Badge key={attendeeId} variant="secondary" className="pl-1 pr-1 py-1 gap-1">
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={employee.avatar || undefined} />
                                                <AvatarFallback className="text-[10px]">{employee.name.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs">{employee.name}</span>
                                            <button
                                                onClick={() => setFormData(prev => ({
                                                    ...prev,
                                                    attendees: prev.attendees.filter(id => id !== attendeeId)
                                                }))}
                                                className="hover:bg-muted p-0.5 rounded-full"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    );
                                })}
                            </div>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-fit gap-2">
                                        <Plus className="h-4 w-4" />
                                        Add Attendee
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search team members..." />
                                        <CommandList>
                                            <CommandEmpty>No team member found.</CommandEmpty>
                                            <CommandGroup>
                                                {employees.map((employee) => (
                                                    <CommandItem
                                                        key={employee.id}
                                                        value={employee.name}
                                                        onSelect={() => {
                                                            const id = employee.id || '';
                                                            if (!formData.attendees.includes(id)) {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    attendees: [...prev.attendees, id]
                                                                }))
                                                            } else {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    attendees: prev.attendees.filter(aid => aid !== id)
                                                                }))
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <Avatar className="h-6 w-6">
                                                                <AvatarImage src={employee.avatar || undefined} />
                                                                <AvatarFallback className="text-[10px]">{employee.name.substring(0, 2)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium">{employee.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">{employee.department}</span>
                                                            </div>
                                                        </div>
                                                        <Check
                                                            className={cn(
                                                                "h-4 w-4 text-primary",
                                                                formData.attendees.includes(employee.id || '') ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            <Textarea
                                id="meeting-notes"
                                placeholder="What will be discussed?"
                                className="min-h-[100px] resize-none"
                                value={formData.notes}
                                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                            />
                        </div>
                    </div>


                </div>

                <SheetFooter className="mt-auto pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-primary shadow-lg shadow-primary/20"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Schedule & Send Email
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
