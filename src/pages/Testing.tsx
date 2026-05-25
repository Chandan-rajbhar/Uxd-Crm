import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjects } from "src/hooks/useProjects";

export default function TestingPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { projects } = useProjects();
  const project = useMemo(
    () => projects.find((project) => project.id === id),
    [projects, id],
  );

  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-6 border border-slate-200 p-2 shadow-sm transition hover:shadow-md md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            Testing Workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {project?.name ? `${project.name} Testing` : "Project Testing"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Track test cases for this project with execution results, status,
            and developer feedback.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="h-10"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="secondary" size="sm" className="h-10">
            <Plus className="h-4 w-4" /> Add Test Case
          </Button>
        </div>
      </div>
      <div className="overflow-auto rounded-md border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test Case ID</TableHead>
              <TableHead>Test Case Title</TableHead>
              <TableHead>Preconditions</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Expected Result</TableHead>
              <TableHead>Actual Result</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tester Name</TableHead>
              <TableHead>Execution Date</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Developer Status</TableHead>
              <TableHead>Developer Name</TableHead>
              <TableHead>Fixed Date</TableHead>
              <TableHead>QA Status</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>
    </div>

    
  );
}
