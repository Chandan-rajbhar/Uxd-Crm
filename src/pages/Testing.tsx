import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const columnHeaders = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)),
    [],
  );

  // column -> TestCase field mapping (editable)
  const defaultMap = [
    "id",
    "title",
    "preconditions",
    "steps",
    "expectedResult",
    "actualResult",
    "status",
    "testerName",
    "executionDate",
    "link",
    "developerStatus",
    "developerName",
    "fixedDate",
    "qaStatus",
  ].concat(Array(26 - 14).fill("")) as (keyof TestCase | "")[];

  const [colFieldMapping, setColFieldMapping] =
    useState<(keyof TestCase | "")[]>(defaultMap);

  const columnLabels = useMemo(
    () =>
      [
        "Test Case ID",
        "Test Case Title",
        "Preconditions",
        "Steps",
        "Expected Result",
        "Actual Result",
        "Status",
        "Tester Name",
        "Execution Date",
        "Link",
        "Developer Status",
        "Developer Name",
        "Fixed Date",
        "QA Status",
      ].concat(Array(26 - 14).fill("")),
    [],
  );

  const [sheetData, setSheetData] = useState<string[][]>(() =>
    Array.from({ length: 1000 }, () => Array(26).fill("")),
  );

  const [editingCell, setEditingCell] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  const [colWidths, setColWidths] = useState<number[]>(
    Array.from({ length: 26 }, () => 120),
  );

  // Function to measure text width
  const measureTextWidth = (text: string, fontSize: string = "12px", fontWeight: string = "400"): number => {
    if (!text) return 0;

    // Create a temporary span element to measure text
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'nowrap';
    span.style.fontSize = fontSize;
    span.style.fontWeight = fontWeight;
    span.textContent = text;

    document.body.appendChild(span);
    const width = span.getBoundingClientRect().width;
    document.body.removeChild(span);

    // Add some padding
    return width + 20; // 20px padding (10px each side)
  };

  const resizeRef = useRef<{
    startX: number;
    col: number;
    startWidth: number;
  } | null>(null);

  // Sync sheetData from testCases whenever testCases change
  useEffect(() => {
    setSheetData((prev) => {
      const newData = Array.from({ length: 1000 }, () => Array(26).fill(""));
      testCases.forEach((tc, i) => {
        const row = Array(26).fill("");
        row[0] = tc.id || "";
        row[1] = tc.title || "";
        row[2] = tc.preconditions || "";
        row[3] = tc.steps || "";
        row[4] = tc.expectedResult || "";
        row[5] = tc.actualResult || "";
        row[6] = tc.status || "";
        row[7] = tc.testerName || "";
        row[8] = tc.executionDate || "";
        row[9] = tc.link || "";
        row[10] = tc.developerStatus || "";
        row[11] = tc.developerName || "";
        row[12] = tc.fixedDate || "";
        row[13] = tc.qaStatus || "";
        newData[i] = row;
      });
      // preserve any previously edited cells beyond current testCases by copying from prev
      for (let i = testCases.length; i < 1000; i++) {
        if (prev[i]) newData[i] = prev[i];
      }
      return newData;
    });
  }, [testCases]);

  const commitEdit = (r: number, c: number, value: string) => {
    setSheetData((prev) => {
      const next = prev.map((row) => row.slice());
      if (next[r]) next[r][c] = value;
      return next;
    });
    setEditingCell(null);
    setEditValue("");

    // propagate to testCases if editing an existing test case row and column mapped
    if (r < testCases.length) {
      const field = colFieldMapping[c];
      if (field) {
        updateTestCase(testCases[r].id, field, value);
      }
    }
  };

  const startResize = (col: number, e: any) => {
    resizeRef.current = { startX: e.clientX, col, startWidth: colWidths[col] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      setColWidths((prev) => {
        const next = prev.slice();
        next[resizeRef.current!.col] = Math.max(
          40,
          resizeRef.current!.startWidth + delta,
        );
        return next;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      resizeRef.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

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
      steps: "Review table",
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

    // Add to testCases; useEffect will sync to sheetData automatically
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
    <div className="flex flex-col h-[calc(100vh-11rem)] md:h-[calc(100vh-5.5rem)] w-full max-w-full min-w-0 overflow-hidden p-4 space-y-4 bg-slate-50/30">
      <div className="flex flex-col gap-4 border border-slate-200 p-4 shadow-sm transition hover:shadow-md md:flex-row md:items-center md:justify-between shrink-0 rounded-lg bg-white">
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
          {/* Excel sheet always visible and synced to test cases */}
        </div>
      </div>
      <div className="flex-1 min-h-0 w-full max-w-full min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/*  */}

        {/* Delete Confirmation Modal */}
        {isDeleteOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Are you absolutely sure?
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                This action cannot be undone. This will permanently delete the
                test case and remove it from the timeline.
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
                  onClick={() =>
                    testCaseToDelete && removeTestCase(testCaseToDelete)
                  }
                  className="px-4 py-2"
                >
                  Delete Test Case
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-slate-100 border border-slate-200 px-2 py-2 text-left text-xs uppercase tracking-[0.24em]">
                  #
                </th>

                {columnLabels.map((label, i) => (
                  <th
                    key={i}
                    style={{ width: colWidths[i], minWidth: colWidths[i] }}
                    className="sticky  top-0 z-20 border border-b-slate-950 bg-slate-100 text-left align-top whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-[12px] text-center uppercase  tracking-[0.24em] text-slate-500">
                        {columnHeaders[i]}
                      </span>
                      <span className="text-[12px] font-semibold text-slate-700 text-center">
                        {label || "\u00A0"}
                      </span>
                    </div>
                    <div
                      onMouseDown={(e) => startResize(i, e)}
                      className="h-5 w-2 cursor-col-resize mt-1"
                      title="Drag to resize"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  <td className={`sticky left-0 z-10 border border-slate-200 px-2 py-1 text-xs font-semibold ${rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                    {rowIndex + 1}
                  </td>
                  {row.map((cell, colIndex) => {
                    const isEditing = !!(
                      editingCell &&
                      editingCell.r === rowIndex &&
                      editingCell.c === colIndex
                    );
                    return (
                      <td
                        key={`${colIndex}-${rowIndex}`}
                        style={{ width: colWidths[colIndex] }}
                        className="border border-slate-200 px-2 py-1 min-w-[6rem] align-top"
                        onClick={() => {
                          setEditingCell({ r: rowIndex, c: colIndex });
                          setEditValue(cell || "");
                        }}
                      >
                        {isEditing ? (
                           <input
                             type="text"
                             autoFocus
                             value={editValue}
                             onChange={(e) => setEditValue(e.target.value)}
                             onBlur={() => commitEdit(rowIndex, colIndex, editValue)}
                             onKeyDown={(e) => {
                               if (e.key === "Enter")
                                 commitEdit(rowIndex, colIndex, editValue);
                               if (e.key === "Escape") {
                                 setEditingCell(null);
                                 setEditValue("");
                               }
                             }}
                             size={Math.max(editValue.length, 5)}
                             className="w-auto text-sm"
                           />
                        ) : (
                          <div className="text-xs min-h-[10px] ">{cell}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
