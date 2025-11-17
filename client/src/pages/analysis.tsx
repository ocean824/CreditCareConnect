import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import { DocumentHistoryPanel } from "@/components/DocumentHistoryPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Shield, DollarSign, Target } from "lucide-react";
import type { CreditReport, Violation } from "@shared/schema";

export default function Analysis() {
  const { user, isLoading } = useAuth();
  const [viewingDocument, setViewingDocument] = useState<any>(null);

  const { data: creditReports } = useQuery<CreditReport[]>({
    queryKey: ["/api/credit-reports"],
    enabled: !!user,
  });

  const { data: violations } = useQuery<Violation[]>({
    queryKey: ["/api/violations"],
    enabled: !!user,
  });

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
  
  // Calculate estimated potential deletions based on violation count
  // Rough estimate: $2,500-$5,000 per violation depending on severity
  const potentialDeletions = violations?.reduce((total, v) => {
    const value = v.severity === "HIGH" ? 5000 : v.severity === "MEDIUM" ? 3500 : 2500;
    return total + value;
  }, 0) || 0;
  
  // Calculate estimated score increase based on violations and severity
  // Rough estimate: 10-30 points per high severity, 5-15 per medium, 2-8 per low
  const estimatedScoreIncrease = violations?.reduce((total, v) => {
    const points = v.severity === "HIGH" ? 20 : v.severity === "MEDIUM" ? 10 : 5;
    return total + points;
  }, 0) || 0;

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-analysis-title">Credit Report Analysis</h2>
          <p className="text-muted-foreground">AI-powered Metro2 and FCRA compliance analysis</p>
        </div>

        {/* Analysis Results Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
          
          <Card className="text-center" data-testid="stat-potential-deletions">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-green-500 mb-2">
                {potentialDeletions > 0 ? `$${potentialDeletions.toLocaleString()}` : "$0"}
              </div>
              <div className="text-sm text-muted-foreground">Potential Deletions</div>
            </CardContent>
          </Card>
          
          <Card className="text-center" data-testid="stat-score-increase">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-purple-500 mb-2">
                {estimatedScoreIncrease > 0 ? `${Math.max(estimatedScoreIncrease - 10, 0)}-${estimatedScoreIncrease + 20}` : "0"}
              </div>
              <div className="text-sm text-muted-foreground">Est. Score Increase</div>
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
                Upload and analyze your credit reports to identify potential violations
              </p>
              <Button variant="outline" data-testid="button-upload-reports">
                Upload Credit Reports
              </Button>
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
