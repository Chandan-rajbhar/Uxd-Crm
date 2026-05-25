import * as React from "react"
import {
  FolderIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  SparklesIcon,
  UserCogIcon,
  UsersIcon,
  ClipboardList,
  BookOpen,
  Video,
  Monitor,
  Activity,
  Calendar,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { UxdLabLogo } from "@/components/UxdLabLogo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "/avatars/default.jpg",
  },
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Clients",
      url: "/clients",
      icon: UsersIcon,
    },
    {
      title: "Projects",
      url: "/projects",
      icon: FolderIcon,
    },
    {
      title: "Meetings",
      url: "/meetings",
      icon: Video,
    },
    {
      title: "Calendar",
      url: "/calendar",
      icon: Calendar,
    },
    {
      title: "Employees",
      url: "/employees",
      icon: UserCogIcon,
    },


    {
      title: "IT Assets",
      url: "/assets",
      icon: Monitor,
    },
    {
      title: "Sessions",
      url: "/sessions",
      icon: Activity,
    },
    {
      title: "Project Tracker",
      url: "/tasks",
      icon: ClipboardList,
    },
    {
      title: "Daily Updates",
      url: "/daily-updates",
      icon: SparklesIcon,
    },
    {
      title: "Tools",
      url: "#",
      icon: SettingsIcon,
      items: [
        {
          title: "Backlinks",
          url: "/tools/backlinks",
        },
        {
          title: "App Links",
          url: "/tools/app-links",
        },
      ],
    },
    {
      title: "Blogs",
      url: "/tools/blogs",
      icon: BookOpen,
      access: "restricted",
    },

  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: SettingsIcon,
    },
  ],
}

import { useAuth } from "src/contexts/AuthContext"
import { useEmployees } from "src/hooks/useEmployees"
import { useProjects } from "src/hooks/useProjects"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, isAdmin, role } = useAuth()
  const { employees } = useEmployees()
  const { projects } = useProjects()

  const userData = {
    name: user?.displayName || user?.email?.split('@')[0] || "User",
    email: user?.email || "",
    avatar: user?.photoURL || "/avatars/default.jpg",
  }

  // Employee Navigation Logic
  const employeeNav = React.useMemo(() => {
    if (isAdmin) return []

    const currentEmployee = employees.find(e => e.authUid === user?.uid || e.email === user?.email)
    const myName = currentEmployee?.name

    const myProjects = projects.filter(p => {
      // 0. Check Assigned Team [NEW]
      const team = currentEmployee?.team?.trim();
      if (team) {
        if (p.assignedTeams?.includes(team)) return true;
        if (p.assignedTeam?.trim() && p.assignedTeam.trim() === team) return true;
      }

      if (!myName) return false

      // 1. Check if in Dev Team
      const inDevTeam = p.devTeam?.some((dev: any) => (typeof dev === 'string' ? dev : dev.name) === myName)
      if (inDevTeam) return true

      // 2. Check if has assigned tasks
      if (p.milestones && Array.isArray(p.milestones)) {
        return p.milestones.some((task: any) => {
          const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : [])
          return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === myName)
        })
      }
      return false;
    })

    return [
      {
        title: "Home",
        url: "/",
        icon: LayoutDashboardIcon,
      },
      {
        title: "My Projects",
        url: "#",
        icon: FolderIcon,
        isActive: true,
        access: "restricted",
        items: myProjects.length > 0 ? myProjects.map(p => ({
          title: p.name,
          url: `/tasks/${p.id}`,
          trackerComment: p.trackerComment,
        })) : [
          {
            title: "No projects assigned",
            url: "#",
          }
        ]
      },
      {
        title: "Meetings",
        url: "/meetings",
        icon: Video,
        access: "restricted",
      },
      {
        title: "Calendar",
        url: "/calendar",
        icon: Calendar,
        access: "restricted",
      },

      {
        title: "Daily Updates",
        url: "/daily-updates",
        icon: SparklesIcon,
        access: "restricted",
      },
      {
        title: "Blogs",
        url: "/tools/blogs",
        icon: BookOpen,
        access: "restricted",
      },
      {
        title: "IT Assets",
        url: "/assets",
        icon: Monitor,
        access: "restricted",
      },
      {
        title: "Employees",
        url: "/employees",
        icon: UserCogIcon,
        access: "restricted",
      },

      {
        title: "Tools",
        url: "#",
        icon: SettingsIcon,
        items: [
          {
            title: "Backlinks",
            url: "/tools/backlinks",
          },
          {
            title: "App Links",
            url: "/tools/app-links",
          },
        ],
      },

    ]
  }, [isAdmin, user, employees, projects])

  // Filter main nav based on access
  const filteredNavMain = React.useMemo(() => {
    if (role === 'client') {
      const myProjects = projects.filter(p => {
        // 1. Exact Email Match (Best)
        if (p.clientEmail && user?.email) {
          if (p.clientEmail.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
        }

        // 2. Name Match (Fallback)
        const clientName = p.client?.toLowerCase().trim();
        const userName = user?.displayName?.toLowerCase().trim();

        if (!clientName || !userName) return false;

        return clientName === userName || clientName.includes(userName) || userName.includes(clientName);
      })

      return [
        {
          title: "Home",
          url: "/",
          icon: LayoutDashboardIcon,
        },
        {
          title: "Calendar",
          url: "/calendar",
          icon: Calendar,
        },
        {
          title: "Projects",
          url: "#",
          icon: FolderIcon,
          isActive: true,
          items: myProjects.length > 0 ? myProjects.map(p => ({
            title: p.name,
            url: `/tasks/${p.id}`,
            trackerComment: p.trackerComment,
          })) : [
            {
              title: "No projects found",
              url: "#",
            }
          ]
        }
      ]
    }

    const defaultNav = isAdmin ? data.navMain : employeeNav

    // Optimistically find current employee once for checks inside filter
    const currentEmployee = !isAdmin ? employees.find(e =>
      e.authUid === user?.uid ||
      (e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase())
    ) : null;

    return defaultNav.map(item => {
      // Deep filter sub-items (like App Links)
      if (item.items) {
        return {
          ...item,
          items: item.items.filter(subItem => {
            if (subItem.title === "App Links") {
              if (isAdmin) return true;
              
              const isFlutter = 
                currentEmployee?.role?.toLowerCase().includes('flutter') ||
                currentEmployee?.team?.toLowerCase().includes('flutter') ||
                currentEmployee?.department?.toLowerCase().includes('flutter');
              
              return isFlutter;
            }
            return true;
          })
        };
      }
      return item;
    }).filter(item => {
      // If no access restriction, show it
      if (!('access' in item)) return true;
      if (item.access !== 'restricted') return true;

      const dept = currentEmployee?.department?.toLowerCase().trim() || "";
      const isLeadMember = dept === "email marketing" || dept === "bde";

      // Hide Projects and Daily Updates for Lead members
      if (item.title === "My Projects" || item.title === "Daily Updates") {
        if (isAdmin) return true;
        return !isLeadMember;
      }

      // Handle restricted items (Blogs)
      if (item.title === "Blogs") {
        if (isAdmin) return true;

        const checkDM = (val?: string) => {
          if (!val) return false;
          const n = val.trim().toLowerCase().replace(/\s+/g, '');
          return n === 'dm' || n === 'digitalmarketing';
        }

        const isDigitalMarketing =
          checkDM(currentEmployee?.team) ||
          checkDM(currentEmployee?.department)

        return isDigitalMarketing;
      }

      // Handle restricted items (Meetings)
      if (item.title === "Meetings") {
        if (isAdmin) return true;

        const checkBD = (val?: string) => {
          if (!val) return false;
          const n = val.trim().toLowerCase();
          return n === 'bde';
        }

        const checkDM = (val?: string) => {
          if (!val) return false;
          const n = val.trim().toLowerCase().replace(/\s+/g, '');
          return n === 'dm' || n === 'digitalmarketing';
        }

        const hasAccess =
          checkBD(currentEmployee?.team) ||
          checkBD(currentEmployee?.department) ||
          checkDM(currentEmployee?.team) ||
          checkDM(currentEmployee?.department)

        return hasAccess;
      }

      // Handle restricted items (Calendar)
      if (item.title === "Calendar") {
        if (isAdmin) return true;

        const checkDM = (val?: string) => {
          if (!val) return false;
          const n = val.trim().toLowerCase().replace(/\s+/g, '');
          return n === 'dm' || n === 'digitalmarketing';
        }

        const isDigitalMarketing =
          checkDM(currentEmployee?.team) ||
          checkDM(currentEmployee?.department)

        return isDigitalMarketing;
      }



      // Handle restricted items (IT Assets)
      if (item.title === "IT Assets") {
        if (isAdmin) return true;

        const checkNetworking = (val?: string) => {
          if (!val) return false;
          const n = val.trim().toLowerCase();
          return n.includes('network') || n.includes('networking') || n === 'it' || n.includes('information technology') || n.includes('infrastructure') || n.includes('sysadmin');
        }

        const isNetworking =
          checkNetworking(currentEmployee?.team) ||
          checkNetworking(currentEmployee?.department)

        return isNetworking;
      }

      // Handle restricted items (HR: Employee Management)
      if (item.title === "Employees") {
        if (isAdmin) return true;

        const checkHR = (val?: string) => {
          if (!val) return false;
          const n = val.trim().toLowerCase();
          return /\bhr\b/.test(n) || n.includes('human') || n.includes('humar') || n.includes('recruitment') || n.includes('talent');
        }

        const isHR =
          checkHR(currentEmployee?.team) ||
          checkHR(currentEmployee?.department)

        const isTeamLead = currentEmployee?.isTeamLead === true;

        return isHR || isTeamLead;
      }

      return true;
    }).filter(item => {
      // Hide Daily Updates for Admins
      if (isAdmin && item.title === "Daily Updates") return false;
      return true;
    })
  }, [isAdmin, employeeNav, employees, user, role])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-center py-2">
              <UxdLabLogo className="scale-75 origin-left" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNavMain} />
        {role !== 'client' && <NavSecondary items={data.navSecondary} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
