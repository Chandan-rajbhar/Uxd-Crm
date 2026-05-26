import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useProjects } from "src/hooks/useProjects";
import * as XLSX from "xlsx";

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
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [testCaseToDelete, setTestCaseToDelete] = useState<string | null>(null);

  const storageKey = `testing-test-cases-${id || "global"}`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TestCase[];
        setTestCases(parsed);
      } catch (error) {
        console.error("Failed to parse saved test cases", error);
      }
    }

    setIsHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(testCases));
  }, [storageKey, testCases, isHydrated]);

  const project = useMemo(
    () => projects.find((project) => project.id === id),
    [projects, id],
  );

  const addDummyTestCase = () => {
    const nextIndex = testCases.length + 1;
    const newCase: TestCase = {
      id: `TC00${nextIndex}`,
      title: "UI validation",
      preconditions: "logged in",
      steps: "review table",
      expectedResult: "Table shows",
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

    setTestCases((current) => [newCase, ...current]);
  };

  const updateTestCase = (id: string, field: keyof TestCase, value: string) => {
    setTestCases((current) =>
      current.map((testCase) =>
        testCase.id === id ? { ...testCase, [field]: value } : testCase,
      ),
    );
  };

  const removeTestCase = (id: string) => {
    setTestCases((current) => current.filter((testCase) => testCase.id !== id));
    setIsDeleteOpen(false);
    setTestCaseToDelete(null);
  };

  const handleDeleteClick = (id: string) => {
    setTestCaseToDelete(id);
    setIsDeleteOpen(true);
  };

  const addLink = (id: string) => {
    if (typeof window === "undefined") return;
    const url = window.prompt("Enter link (include https://)")?.trim();
    if (url) updateTestCase(id, "link", url);
  };

  const exportTestCases = () => {
    if (testCases.length === 0) return;

    const data = testCases.map((testCase) => ({
      "Test Case ID": testCase.id,
      "Test Case Title": testCase.title,
      Preconditions: testCase.preconditions,
      Steps: testCase.steps,
      "Expected Result": testCase.expectedResult,
      "Actual Result": testCase.actualResult,
      Status: testCase.status,
      "Tester Name": testCase.testerName,
      "Execution Date": testCase.executionDate,
      Link: testCase.link,
      "Developer Status": testCase.developerStatus,
      "Developer Name": testCase.developerName,
      "Fixed Date": testCase.fixedDate,
      "QA Status": testCase.qaStatus,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Test Cases");

    const fileName = `${project?.name?.replace(/\s+/g, "_") || "test_cases"}_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={exportTestCases}
          >
            <Download className="h-4 w-4" /> Export Excel
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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {testCases.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={15}
                  className="p-6 text-center text-sm text-slate-500"
                >
                  No test cases yet. Click Add Test Case to insert a dummy row.
                </TableCell>
              </TableRow>
            ) : (
              testCases.map((testCase) => (
                <TableRow key={testCase.id}>
                  <TableCell>
                    <Input
                      value={testCase.id}
                      onChange={(event) =>
                        updateTestCase(testCase.id, "id", event.target.value)
                      }
                      className="h-9 w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.title}
                      onChange={(event) =>
                        updateTestCase(testCase.id, "title", event.target.value)
                      }
                      className="h-9 w-full px-3"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.preconditions}
                      onChange={(event) =>
                        updateTestCase(
                          testCase.id,
                          "preconditions",
                          event.target.value,
                        )
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.steps}
                      onChange={(event) =>
                        updateTestCase(testCase.id, "steps", event.target.value)
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.expectedResult}
                      onChange={(event) =>
                        updateTestCase(
                          testCase.id,
                          "expectedResult",
                          event.target.value,
                        )
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.actualResult}
                      onChange={(event) =>
                        updateTestCase(
                          testCase.id,
                          "actualResult",
                          event.target.value,
                        )
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm text-slate-700">
                    <select
                      value={testCase.status}
                      onChange={(event) =>
                        updateTestCase(testCase.id, "status", event.target.value)
                      }
                      className="h-9 w-22 text-sm bg-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Active">Active</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Verified">Verified</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.testerName}
                      onChange={(event) =>
                        updateTestCase(
                          testCase.id,
                          "testerName",
                          event.target.value,
                        )
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.executionDate}
                      onChange={(event) =>
                        updateTestCase(
                          testCase.id,
                          "executionDate",
                          event.target.value,
                        )
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    {testCase.link ? (
                      testCase.link.startsWith("http") ? (
                        <a
                          href={testCase.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 underline"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-sm cursor-pointer">{testCase.link}</span>
                      )
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => addLink(testCase.id)} className="h-8">
                        Add Link
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.developerStatus}
                      onChange={(event) =>
                        updateTestCase(
                          testCase.id,
                          "developerStatus",
                          event.target.value,
                        )
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.developerName}
                      onChange={(event) =>
                        updateTestCase(
                          testCase.id,
                          "developerName",
                          event.target.value,
                        )
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={testCase.fixedDate}
                      onChange={(event) =>
                        updateTestCase(
                          testCase.id,
                          "fixedDate",
                          event.target.value,
                        )
                      }
                      className="h-9 w-full"
                    />
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm text-slate-700">
                    <select
                      value={testCase.qaStatus}
                      onChange={(event) => {
                        updateTestCase(testCase.id, "qaStatus", event.target.value);
                        
                      }}
                      className="h-9 w-25 rounded text-sm bg-white "
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Passed">Passed</option>
                      <option value="Failed">Failed</option>
                      <option value="Blocked">Blocked</option>
                      <option value="QA Completed">QA Completed</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-9 px-2 ml-4"
                      onClick={() => handleDeleteClick(testCase.id)}
                    >
                      <Trash2 className="h-4 w-4"/>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Are you absolutely sure?</h2>
            <p className="text-sm text-slate-600 mb-6">
              This action cannot be undone. This will permanently delete the test case and remove it from the timeline.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setTestCaseToDelete(null);
                }}
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => testCaseToDelete && removeTestCase(testCaseToDelete)}
                className="px-4 py-2"
              >
                Delete Test Case
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
