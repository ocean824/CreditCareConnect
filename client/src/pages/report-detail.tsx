import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download } from "lucide-react";
import { useState } from "react";
import { useCreditReport, useViolations } from "@/hooks/useCreditReports";

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [, navigate] = useLocation();
  const { data: report, isLoading: reportLoading } = useCreditReport(reportId || "");
  const { data: violations, isLoading: violationsLoading } = useViolations(reportId || "");
  const [selectedViolations, setSelectedViolations] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!reportId) {
    return <div>Invalid report ID</div>;
  }

  if (reportLoading || violationsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Report Not Found</h1>
        <Button onClick={() => navigate("/reports")}>Back to Reports</Button>
      </div>
    );
  }

  const handleGenerateLetter = async () => {
    if (selectedViolations.length === 0) {
      alert("Please select at least one violation");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/dispute-letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          violationIds: selectedViolations,
          round: 1,
          recipientType: "BUREAU",
          target: "EXPERIAN",
        }),
        credentials: "include",
      });

      if (response.ok) {
        alert("Letter generated successfully!");
        navigate("/letters");
      } else {
        alert("Failed to generate letter");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const categoryGroups = violations?.reduce((acc: any, v: any) => {
    const cat = v.category || "OTHER";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {}) || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" className="mb-4" onClick={() => navigate("/reports")}>
          ← Back to Reports
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{report.fileName}</h1>
          <p className="text-gray-600 dark:text-gray-400">{report.bureau} • Status: {report.analysisStatus}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card className="mb-6 dark:border-slate-700">
              <CardHeader>
                <CardTitle>Violations Found</CardTitle>
                <CardDescription>
                  {violations?.length || 0} potential FCRA, Metro 2, and FDCPA violations detected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(categoryGroups).map(([category, items]: [string, any]) => (
                    <div key={category}>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Badge>{category}</Badge>
                        <span className="text-sm text-gray-600 dark:text-gray-400">({items.length})</span>
                      </h3>
                      <div className="space-y-2 ml-4">
                        {items.map((violation: any) => (
                          <div key={violation.id} className="flex items-start gap-3 p-3 rounded-lg border dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <input
                              type="checkbox"
                              id={violation.id}
                              checked={selectedViolations.includes(violation.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedViolations([...selectedViolations, violation.id]);
                                } else {
                                  setSelectedViolations(selectedViolations.filter((id) => id !== violation.id));
                                }
                              }}
                              className="mt-1"
                            />
                            <label htmlFor={violation.id} className="flex-1 cursor-pointer">
                              <p className="font-medium text-sm">{violation.title || violation.violationType}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{violation.description}</p>
                            </label>
                            <Badge variant={violation.severity === "HIGH" ? "destructive" : "outline"} className="ml-2">
                              {violation.severity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg">Generate Letter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Selected: <span className="font-semibold">{selectedViolations.length}</span> violations
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Select violations above to include in your dispute letter
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Recipient Type</label>
                  <select className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700">
                    <option>Credit Bureau</option>
                    <option>Debt Collector</option>
                  </select>
                </div>

                <Button onClick={handleGenerateLetter} disabled={selectedViolations.length === 0 || isGenerating} className="w-full">
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Generate Dispute Letter
                </Button>

                <Button variant="outline" className="w-full" onClick={() => navigate("/letters")}>
                  View Previous Letters
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
