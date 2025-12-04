import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import { DocumentHistoryPanel } from "@/components/DocumentHistoryPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Shield, DollarSign, Target, Trash2, RefreshCw, Bug } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { CreditReport, Violation } from "@shared/schema";

export default function Analysis() {
  const { user, isLoading } = useAuth();
  const [viewingDocument, setViewingDocument] = useState<any>(null);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    setRunningDiagnostic(true);
    setDiagnosticResults(null);
    try {
      const response = await apiRequest('POST', '/api/diagnostics/test-analysis');
      const results = await response.json();
      setDiagnosticResults(results);
      if (results.success && results.rulesEngine?.issuesFound > 0) {
        toast({
          title: "Diagnostic Complete",
          description: `Analysis pipeline working: ${results.rulesEngine.issuesFound} violations detected`,
        });
      } else if (!results.success) {
        toast({
          title: "Diagnostic Found Issues",
          description: "Check the diagnostic output for error details",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Analysis Pipeline Issue",
          description: "No violations detected - check data quality",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Diagnostic Failed",
        description: error.message || "Could not run diagnostic",
        variant: "destructive",
      });
    } finally {
      setRunningDiagnostic(false);
    }
  };

  const { data: creditReports, refetch: refetchReports } = useQuery<CreditReport[]>({
    queryKey: ["/api/credit-reports"],
    enabled: !!user,
  });

  const { data: violations, refetch: refetchViolations } = useQuery<Violation[]>({
    queryKey: ["/api/violations"],
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return await apiRequest('DELETE', `/api/credit-reports/${reportId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Credit report deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete credit report",
        variant: "destructive",
      });
    },
  });

  const handleReanalyze = async (reportId: string) => {
    setReanalyzing(reportId);
    try {
      const response = await apiRequest('POST', `/api/credit-reports/${reportId}/force-reanalyze`);
      const result = await response.json();
      toast({
        title: "Re-analysis Complete",
        description: result.message || `Found ${result.violationsFound || 0} violations`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
    } catch (error: any) {
      toast({
        title: "Re-analysis Failed",
        description: error.message || "Could not re-analyze the report",
        variant: "destructive",
      });
    } finally {
      setReanalyzing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const completedReports = creditReports?.filter(report => report.analysisStatus === "COMPLETED") || [];
  const totalViolations = violations?.length || 0;
  const bureausAffected = new Set(violations?.map(v => v.bureau) || []).size;
  const highSeverityCount = violations?.filter(v => v.severity === "HIGH")?.length || 0;

  const documentHistory = creditReports?.map(report => ({
    id: report.id,
    filename: report.fileName,
    uploadedAt: report.createdAt ? new Date(report.createdAt) : new Date(),
    status: report.analysisStatus === "COMPLETED" ? "complete" as const : 
            report.analysisStatus === "PENDING" ? "processing" as const : 
            report.analysisStatus === "ERROR" ? "error" as const : "uploaded" as const,
    type: "credit-report" as const,
    size: undefined
  })) || [];

  return (
    <div className="min-h-screen bg-background">
      <DocumentHistoryPanel 
        documents={documentHistory}
        onViewDocument={(doc) => setViewingDocument(doc)}
        onDownloadDocument={(doc) => {
          window.open(`/api/credit-reports/${doc.id}/download`, '_blank');
        }}
      />
      
      <Navigation 
        user={user as any} 
        activeTab="analysis"
        onTabChange={() => {}}
      />

      {creditReports && creditReports.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                {creditReports.map((report) => (
                  <div 
                    key={report.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    data-testid={`credit-report-row-${report.id}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{report.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {report.analysisStatus}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReanalyze(report.id)}
                        disabled={reanalyzing === report.id}
                        data-testid={`button-reanalyze-report-${report.id}`}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${reanalyzing === report.id ? 'animate-spin' : ''}`} />
                        {reanalyzing === report.id ? 'Analyzing...' : 'Re-analyze'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(report.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-report-${report.id}`}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-analysis-title">Credit Report Analysis</h2>
          <p className="text-muted-foreground">AI-powered Metro2 and FCRA compliance analysis</p>
        </div>

        {/* Analysis Results Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="text-center" data-testid="stat-total-violations">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-3xl font-bold text-red-500 mb-2">{totalViolations}</div>
              <div className="text-sm text-muted-foreground">Total Violations</div>
            </CardContent>
          </Card>
          
          <Card className="text-center" data-testid="stat-bureaus-affected">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-blue-500 mb-2">{bureausAffected}</div>
              <div className="text-sm text-muted-foreground">Bureaus Affected</div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Violations Table */}
        {violations && violations.length > 0 ? (
          <Card data-testid="violations-table">
            <CardHeader>
              <CardTitle>Detected Violations</CardTitle>
              <CardDescription>
                {totalViolations} violations found across {bureausAffected} credit bureaus
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Account</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Bureau</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Violation</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Statute</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Severity</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((violation) => (
                      <tr key={violation.id} className="border-b hover:bg-muted/30" data-testid={`violation-row-${violation.id}`}>
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-medium text-sm">{violation.accountName}</div>
                            {violation.accountNumber && (
                              <div className="text-xs text-muted-foreground">{violation.accountNumber}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-medium">{violation.bureau}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm max-w-xs">
                            <div className="font-medium">{violation.violationType}</div>
                            <div className="text-muted-foreground text-xs mt-1">{violation.description}</div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className="text-xs font-mono">
                            {violation.statute}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <Badge 
                            variant={violation.severity === "HIGH" ? "destructive" : 
                                    violation.severity === "MEDIUM" ? "secondary" : "outline"}
                            className={
                              violation.severity === "HIGH" ? "bg-red-100 text-red-800" :
                              violation.severity === "MEDIUM" ? "bg-orange-100 text-orange-800" :
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {violation.severity}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <Button 
                            size="sm" 
                            variant="link" 
                            className="text-primary h-auto p-0"
                            data-testid={`button-generate-letter-${violation.id}`}
                          >
                            Generate Letter
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="no-violations-card">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Violations Detected</h3>
              <p className="text-muted-foreground mb-4">
                {creditReports && creditReports.length > 0 
                  ? `You have ${creditReports.length} report(s). Click "Re-analyze All" to scan for violations with the latest detection rules.`
                  : "Upload and analyze your credit reports to identify potential violations"
                }
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" data-testid="button-upload-reports">
                  Upload Credit Reports
                </Button>
                {creditReports && creditReports.length > 0 && (
                  <>
                    <Button 
                      variant="default"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={async () => {
                        for (const report of creditReports) {
                          await handleReanalyze(report.id);
                        }
                      }}
                      disabled={reanalyzing !== null}
                      data-testid="button-reanalyze-all"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${reanalyzing ? 'animate-spin' : ''}`} />
                      {reanalyzing ? 'Re-analyzing...' : `Re-analyze All (${creditReports.length})`}
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={runDiagnostic}
                      disabled={runningDiagnostic}
                      data-testid="button-run-diagnostic"
                    >
                      <Bug className={`w-4 h-4 mr-2 ${runningDiagnostic ? 'animate-spin' : ''}`} />
                      {runningDiagnostic ? 'Running...' : 'Run Diagnostic'}
                    </Button>
                  </>
                )}
              </div>
              
              {diagnosticResults && (
                <div className="mt-6 text-left bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Diagnostic Results
                  </h4>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Environment:</span>
                      <span className="font-mono">{diagnosticResults.environment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Config:</span>
                      <span className="font-mono">
                        {diagnosticResults.aiConfig?.hasReplitAI ? 'Replit AI' : 
                         diagnosticResults.aiConfig?.hasUserOpenAI ? 'OpenAI' : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reports Found:</span>
                      <span className="font-mono">{diagnosticResults.reportCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Violations in DB:</span>
                      <span className="font-mono">{diagnosticResults.violationCount}</span>
                    </div>
                    {diagnosticResults.rulesEngine && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Issues Detected by Rules:</span>
                        <span className="font-mono font-bold text-green-600">
                          {diagnosticResults.rulesEngine.issuesFound}
                        </span>
                      </div>
                    )}
                    
                    {diagnosticResults.steps && (
                      <div className="mt-4 border-t pt-3">
                        <h5 className="font-medium mb-2">Pipeline Steps:</h5>
                        {diagnosticResults.steps.map((step: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs py-1">
                            <span className={`w-2 h-2 rounded-full ${
                              step.status === 'ok' ? 'bg-green-500' : 
                              step.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}></span>
                            <span className="font-mono">{step.step}</span>
                            <span className="text-muted-foreground ml-auto">
                              {step.status === 'error' ? step.error : step.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {diagnosticResults.errors && diagnosticResults.errors.length > 0 && (
                      <div className="mt-4 border-t pt-3 text-red-600">
                        <h5 className="font-medium mb-2">Errors:</h5>
                        {diagnosticResults.errors.map((err: any, idx: number) => (
                          <div key={idx} className="text-xs py-1">
                            <span className="font-mono">{err.stage}: {err.error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Analysis Summary Card */}
        {violations && violations.length > 0 && (
          <Card className="mt-6" data-testid="analysis-summary">
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500 mb-2">{highSeverityCount}</div>
                  <div className="text-sm text-muted-foreground">High Priority Violations</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    These violations have the highest potential for removal and score improvement
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500 mb-2">{completedReports.length}</div>
                  <div className="text-sm text-muted-foreground">Reports Analyzed</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Credit reports successfully processed by our AI analysis engine
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500 mb-2">
                    {Math.round((violations.filter(v => v.status === "IDENTIFIED").length / Math.max(totalViolations, 1)) * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Actionable Items</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Percentage of violations ready for dispute letter generation
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
