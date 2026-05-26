import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Table, TableHead, TableHeader, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { useProjects } from "src/hooks/useProjects";

type TestCase = {
  id: string;
  title: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  actualResult: string;
  status: string;
  testerName: string;
  executionDate: string;
  link: string;
  developerStatus: string;
  developerName: string;
  fixedDate: string;
  qaStatus: string;
};

export default function TestingPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { projects } = useProjects();
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  const project = useMemo(
    () => projects.find((project) => project.id === id),
    [projects, id],
  );

  const addDummyTestCase = () => {
    const nextIndex = testCases.length + 1;
    const newCase: TestCase = {
      id: `TC00${nextIndex}`,
      title: "UI validation",
      preconditions: "User is logged in",
      steps: "Open testing page and review table",
      expectedResult: "Table shows all fields correctly",
      actualResult: "Pending verification",
      status: "Pending",
      testerName: "QA Team",
      executionDate: new Date().toLocaleDateString(),
      link: "View",
      developerStatus: "Not started",
      developerName: "Dev Team",
      fixedDate: "-",
      qaStatus: "Pending",
    };

    setTestCases((current) => [...current, newCase]);
  };

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
          <Button
            variant="secondary"
            size="sm"
            className="h-10"
            onClick={addDummyTestCase}
          >
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
          <TableBody>
            {testCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="p-6 text-center text-sm text-slate-500">
                  No test cases yet. Click Add Test Case to insert a dummy row.
                </TableCell>
              </TableRow>
            ) : (
              testCases.map((testCase) => (
                <TableRow key={testCase.id}>
                  <TableCell>{testCase.id}</TableCell>
                  <TableCell>{testCase.title}</TableCell>
                  <TableCell>{testCase.preconditions}</TableCell>
                  <TableCell>{testCase.steps}</TableCell>
                  <TableCell>{testCase.expectedResult}</TableCell>
                  <TableCell>{testCase.actualResult}</TableCell>
                  <TableCell>{testCase.status}</TableCell>
                  <TableCell>{testCase.testerName}</TableCell>
                  <TableCell>{testCase.executionDate}</TableCell>
                  <TableCell>{testCase.link}</TableCell>
                  <TableCell>{testCase.developerStatus}</TableCell>
                  <TableCell>{testCase.developerName}</TableCell>
                  <TableCell>{testCase.fixedDate}</TableCell>
                  <TableCell>{testCase.qaStatus}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>

    
  );
}
