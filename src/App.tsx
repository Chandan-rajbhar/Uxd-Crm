import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import DashboardLayout from "@/layouts/DashboardLayout"
import Dashboard from "@/pages/Dashboard"
import LoginPage from "@/pages/Login"
import ClientsPage from "@/pages/Clients"
import ProjectsPage from "@/pages/Projects"
import EmployeesPage from "@/pages/Employees"

import TasksPage from "@/pages/Tasks"
import DailyUpdatesPage from "@/pages/DailyUpdates"
import ProjectDetailsPage from "@/pages/ProjectDetails"
import TestingPage from "@/pages/Testing"
import AppsPage from "@/pages/Apps"
import BacklinksPage from "@/pages/Backlinks"
import BlogsPage from "@/pages/Blogs"
import MeetingsPage from "@/pages/Meetings"
import ProjectMeetingsPage from "@/pages/ProjectMeetings"
import AssetsPage from "@/pages/Assets"
import SettingsPage from "@/pages/Settings"
import SessionsPage from "@/pages/Sessions"

import AppLinksPage from "@/pages/AppLinks"
import ViewAppLink from "@/pages/ViewAppLink"
import CalendarPage from "@/pages/Calendar"
import RequireAuth from "@/components/require-auth"
import RequireAdmin from "@/components/require-admin"
import RequireBlogAccess from "@/components/require-blog-access"
import RequireAssetAccess from "@/components/require-asset-access"
import RequireHRAccess from "@/components/require-hr-access"

import RequireMeetingAccess from "@/components/require-meeting-access"
import RequireFlutterAccess from "@/components/require-flutter-access"
import { Toaster } from "@/components/ui/sonner"
function App() {


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Public Routes */}
        <Route path="/tools/backlinks" element={<BacklinksPage />} />
        <Route path="/view-app-link/:id" element={<ViewAppLink />} />

        <Route element={<RequireAuth />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />

            <Route element={<RequireBlogAccess />}>
              <Route path="/tools/blogs" element={<BlogsPage />} />
            </Route>

            <Route element={<RequireFlutterAccess />}>
              <Route path="/tools/app-links" element={<AppLinksPage />} />
            </Route>

            <Route element={<RequireAssetAccess />}>
              <Route path="/assets" element={<AssetsPage />} />
            </Route>

            <Route element={<RequireHRAccess allowTeamLead={true} />}>
              <Route path="employees" element={<EmployeesPage />} />
            </Route>



            {/* Shared Protected Routes */}
            <Route path="tasks/:id/testing" element={<TestingPage />} />
            <Route path="tasks/:id" element={<ProjectDetailsPage />} />
            <Route path="daily-updates" element={<DailyUpdatesPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            {/* Protected Admin Routes */}
            <Route element={<RequireMeetingAccess />}>
              <Route path="meetings" element={<MeetingsPage />} />
              <Route path="projects/:id/meetings" element={<ProjectMeetingsPage />} />
            </Route>

            <Route element={<RequireAdmin />}>
              <Route path="clients" element={<ClientsPage />} />
              <Route path="projects" element={<ProjectsPage />} />

              <Route path="tasks" element={<TasksPage />} />
              <Route path="apps" element={<AppsPage />} />
              <Route path="sessions" element={<SessionsPage />} />
            </Route>

            <Route path="settings" element={<SettingsPage />} />


          </Route>
        </Route>
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
