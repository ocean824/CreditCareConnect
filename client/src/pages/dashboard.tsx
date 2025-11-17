import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import CreditReportUploader from "@/components/CreditReportUploader";
import AIChat from "@/components/AIChat";
import PlanUpgradeModal from "@/components/PlanUpgradeModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { PRDViewerPanel } from "@/components/PRDViewerPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, AlertCircle, FileText, Download, Eye } from "lucide-react";
import type { CreditReport, Violation, DisputeLetter } from "@shared/schema";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: creditReports } = useQuery<CreditReport[]>({
    queryKey: ["/api/credit-reports"],
    enabled: !!user,
  });

  const { data: violations } = useQuery<Violation[]>({
    queryKey: ["/api/violations"],
    enabled: !!user,
  });

  const { data: disputeLetters } = useQuery<DisputeLetter[]>({
    queryKey: ["/api/dispute-letters"],
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
  const sentLetters = disputeLetters?.filter(letter => letter.status === "SENT")?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <OnboardingModal />
      <PRDViewerPanel />
      
      <Navigation 
        user={user as any} 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            
            {/* Plan Status Header */}
            <div className="bg-gradient-to-r from-primary to-green-500 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold mb-2" data-testid="text-welcome">
                    Welcome back, {user?.firstName || "User"}!
                  </h1>
                  <p className="text-blue-100">
                    Current Plan: <span className="font-semibold">
                      {user?.plan === "DIY" ? "DIY" : user?.plan === "ENTERPRISE" ? "Enterprise" : "Done-For-You"}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                    <div className="text-3xl font-bold">720</div>
                    <div className="text-sm text-blue-100">Credit Score Goal</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Upgrade Section */}
            {user?.plan === "DIY" && (
              <Card className="border-primary border-2" data-testid="card-upgrade">
                <CardHeader className="text-center">
                  <CardTitle>Upgrade to Done-For-You</CardTitle>
                  <CardDescription>Unlock full automation and professional features</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold text-primary mb-4">$149.99/month</div>
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Automated mailing
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      CRM integration
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      SMS notifications
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Priority support
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowUpgradeModal(true)}
                    className="w-full"
                    data-testid="button-upgrade"
                  >
                    Upgrade Now
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card data-testid="stat-reports">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-blue-500 mb-2">{completedReports.length}</div>
                  <div className="text-sm text-muted-foreground">Reports Analyzed</div>
                </CardContent>
              </Card>
              <Card data-testid="stat-violations">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-red-500 mb-2">{totalViolations}</div>
                  <div className="text-sm text-muted-foreground">Violations Found</div>
                </CardContent>
              </Card>
              <Card data-testid="stat-letters">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-green-500 mb-2">{disputeLetters?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Letters Generated</div>
                </CardContent>
              </Card>
              <Card data-testid="stat-sent">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-purple-500 mb-2">{sentLetters}</div>
                  <div className="text-sm text-muted-foreground">Letters Sent</div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Credit Report Upload */}
              <Card data-testid="card-upload">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Credit Report Analysis
                    {completedReports.length > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CreditReportUploader />
                  {totalViolations > 0 && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Credit Report Analyzed</p>
                          <p className="text-xs text-green-600">Found {totalViolations} violations across bureaus</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Progress Dashboard */}
              <Card data-testid="card-progress">
                <CardHeader>
                  <CardTitle>Dispute Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {disputeLetters && disputeLetters.length > 0 ? (
                      disputeLetters.slice(0, 3).map((letter, index) => (
                        <div key={letter.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              letter.status === "SENT" ? "bg-green-500" :
                              letter.status === "GENERATED" ? "bg-yellow-500" : "bg-blue-500"
                            }`}>
                              {letter.status === "SENT" ? (
                                <CheckCircle className="w-4 h-4 text-white" />
                              ) : letter.status === "GENERATED" ? (
                                <FileText className="w-4 h-4 text-white" />
                              ) : (
                                <Clock className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{letter.bureau} Dispute</p>
                              <p className="text-xs text-muted-foreground">
                                {letter.sentAt ? 
                                  `Sent ${new Date(letter.sentAt).toLocaleDateString()}` :
                                  `Created ${new Date(letter.createdAt!).toLocaleDateString()}`
                                }
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant={letter.status === "SENT" ? "default" : letter.status === "GENERATED" ? "secondary" : "outline"}
                            className={
                              letter.status === "SENT" ? "bg-green-100 text-green-800" :
                              letter.status === "GENERATED" ? "bg-yellow-100 text-yellow-800" : 
                              "bg-blue-100 text-blue-800"
                            }
                          >
                            {letter.status === "SENT" ? "Sent" : 
                             letter.status === "GENERATED" ? "Ready" : "Draft"}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p>No dispute letters generated yet</p>
                        <p className="text-sm">Upload your credit reports to get started</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* AI Assistant */}
            <AIChat userPlan={user?.plan || "DIY"} violations={violations} />

          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === "analysis" && (
          <div className="space-y-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Credit Report Analysis</h2>
              <p className="text-muted-foreground">AI-powered Metro2 and FCRA compliance analysis</p>
            </div>

            {/* Analysis Results Overview */}
            {violations && violations.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card className="text-center">
                  <CardContent className="p-6">
                    <div className="text-3xl font-bold text-red-500 mb-2">{totalViolations}</div>
                    <div className="text-sm text-muted-foreground">Total Violations</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-6">
                    <div className="text-3xl font-bold text-blue-500 mb-2">
                      {new Set(violations.map(v => v.bureau)).size}
                    </div>
                    <div className="text-sm text-muted-foreground">Bureaus Affected</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Violations Table */}
            {violations && violations.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Detected Violations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">Account</th>
                          <th className="text-left py-3 px-4">Bureau</th>
                          <th className="text-left py-3 px-4">Violation</th>
                          <th className="text-left py-3 px-4">Statute</th>
                          <th className="text-left py-3 px-4">Severity</th>
                          <th className="text-left py-3 px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {violations.map((violation) => (
                          <tr key={violation.id} className="border-b hover:bg-muted/30">
                            <td className="py-4 px-4">
                              <div>
                                <div className="font-medium">{violation.accountName}</div>
                                {violation.accountNumber && (
                                  <div className="text-sm text-muted-foreground">{violation.accountNumber}</div>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">{violation.bureau}</td>
                            <td className="py-4 px-4">{violation.description}</td>
                            <td className="py-4 px-4">
                              <Badge variant="outline" className="text-xs">
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
                              <Button size="sm" variant="link" className="text-primary">
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
              <Card>
                <CardContent className="text-center py-12">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No Violations Detected</h3>
                  <p className="text-muted-foreground">Upload and analyze your credit reports to identify violations</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Letters Tab */}
        {activeTab === "letters" && (
          <div className="space-y-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Dispute Letters</h2>
              <p className="text-muted-foreground">AI-generated, legally compliant dispute letters</p>
            </div>

            {/* Letter Generation Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {disputeLetters && disputeLetters.length > 0 ? (
                disputeLetters.slice(0, 3).map((letter) => (
                  <Card key={letter.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{letter.bureau} Dispute</CardTitle>
                        <Badge 
                          variant={letter.status === "SENT" ? "default" : "secondary"}
                          className={letter.status === "SENT" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {letter.status === "SENT" ? "Sent" : "Ready"}
                        </Badge>
                      </div>
                      <CardDescription>
                        {letter.letterType} • 2 pages
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button className="w-full" data-testid={`button-download-${letter.bureau.toLowerCase()}`}>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>
                      <Button variant="outline" className="w-full" data-testid={`button-preview-${letter.bureau.toLowerCase()}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        Preview Letter
                      </Button>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-3">
                  <Card>
                    <CardContent className="text-center py-12">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-semibold mb-2">No Letters Generated</h3>
                      <p className="text-muted-foreground">Analyze your credit reports first to generate dispute letters</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* CFPB Escalation */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>CFPB Complaint Packet</CardTitle>
                    <CardDescription>Escalation packet with case law citations</CardDescription>
                  </div>
                  <Button variant="secondary" data-testid="button-generate-cfpb">
                    Generate CFPB Packet
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Includes:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Formal complaint letter</li>
                      <li>• All dispute correspondence</li>
                      <li>• Supporting legal citations</li>
                      <li>• Evidence documentation</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Case Law Citations:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Maxey v. Trans Union (2016)</li>
                      <li>• Johnson v. MBNA (2005)</li>
                      <li>• Phillips v. Grendahl (2000)</li>
                      <li>• Auto-fetched relevant cases</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* Plan Upgrade Modal */}
      <PlanUpgradeModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
