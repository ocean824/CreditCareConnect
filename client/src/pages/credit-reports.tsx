import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { useCreditReports } from "@/hooks/useCreditReports";
import { useLocation } from "wouter";
import CreditReportUploader from "@/components/CreditReportUploader";

export default function CreditReportsPage() {
  const [, navigate] = useLocation();
  const { data: reports, isLoading: reportsLoading } = useCreditReports();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Credit Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">Upload and analyze your credit reports for FCRA, Metro 2, and FDCPA violations</p>
        </div>

        {/* Upload Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload Credit Report</CardTitle>
            <CardDescription>Upload a PDF tri-merge or IdentityIQ report for analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <CreditReportUploader />
          </CardContent>
        </Card>

        {/* Reports List */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Your Reports</h2>

          {reportsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No reports uploaded yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {reports.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition-shadow dark:border-slate-700 cursor-pointer" onClick={() => navigate(`/reports/${report.id}`)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{report.fileName}</CardTitle>
                        <CardDescription>{report.bureau}</CardDescription>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${report.analysisStatus === "COMPLETED" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200"}`}>
                        {report.analysisStatus}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Violations: <span className="font-semibold">{report.violationCount || 0}</span>
                      </p>
                      <Button variant="ghost">View Details →</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
