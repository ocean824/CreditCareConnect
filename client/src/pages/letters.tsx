import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  FileText, 
  Download, 
  Eye, 
  Send, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Scale,
  Gavel
} from "lucide-react";

export default function Letters() {
  const { user, isLoading } = useAuth();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: disputeLetters } = useQuery({
    queryKey: ["/api/dispute-letters"],
    enabled: !!user,
  });

  const { data: violations } = useQuery({
    queryKey: ["/api/violations"],
    enabled: !!user,
  });

  const generateCFPBMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/cfpb-complaints/generate");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "CFPB Packet Generated",
        description: "Your complaint packet with case law citations is ready for download.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cfpb-complaints"] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleDownloadLetter = (letterId: string) => {
    // In a real implementation, this would trigger the download
    window.open(`/api/dispute-letters/${letterId}/download`, '_blank');
  };

  const handlePreviewLetter = (letterId: string) => {
    setSelectedLetter(letterId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "GENERATED":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "DRAFT":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SENT":
        return "bg-green-100 text-green-800";
      case "GENERATED":
        return "bg-blue-100 text-blue-800";
      case "DRAFT":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        user={user} 
        activeTab="letters"
        onTabChange={() => {}}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-letters-title">Dispute Letters</h2>
          <p className="text-muted-foreground">AI-generated, legally compliant dispute letters</p>
        </div>

        {/* Letter Generation Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {disputeLetters && disputeLetters.length > 0 ? (
            disputeLetters.slice(0, 3).map((letter) => (
              <Card key={letter.id} data-testid={`letter-card-${letter.bureau.toLowerCase()}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      {getStatusIcon(letter.status)}
                      <span>{letter.bureau} Dispute</span>
                    </CardTitle>
                    <Badge className={getStatusColor(letter.status)}>
                      {letter.status === "SENT" ? "Sent" : 
                       letter.status === "GENERATED" ? "Ready" : "Draft"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {letter.letterType} • Generated {new Date(letter.createdAt!).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => handleDownloadLetter(letter.id)}
                    data-testid={`button-download-${letter.bureau.toLowerCase()}`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handlePreviewLetter(letter.id)}
                    data-testid={`button-preview-${letter.bureau.toLowerCase()}`}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Letter
                  </Button>
                  {letter.status === "GENERATED" && user?.plan === "DONE_FOR_YOU" && (
                    <Button 
                      variant="secondary" 
                      className="w-full"
                      data-testid={`button-send-${letter.bureau.toLowerCase()}`}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send via Click2Mail
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-3">
              <Card data-testid="no-letters-card">
                <CardContent className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No Letters Generated</h3>
                  <p className="text-muted-foreground mb-4">
                    Analyze your credit reports first to generate dispute letters
                  </p>
                  <Button variant="outline" data-testid="button-go-to-analysis">
                    Go to Analysis
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Letter Preview Section */}
        {selectedLetter && (
          <Card className="mb-8" data-testid="letter-preview">
            <CardHeader>
              <CardTitle>Letter Preview</CardTitle>
              <CardDescription>
                Preview of your generated dispute letter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white border border-gray-300 rounded-lg p-6 font-mono text-sm leading-relaxed max-h-96 overflow-y-auto">
                <div className="mb-4">
                  <p><strong>{user?.firstName} {user?.lastName}</strong></p>
                  <p>123 Main Street</p>
                  <p>Anytown, FL 32801</p>
                  <p>DOB: 01/01/1990 | SSN: XXX-XX-1234</p>
                  <p>Date: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="mb-4">
                  <p><strong>Equifax Information Services LLC</strong></p>
                  <p>P.O. Box 740256</p>
                  <p>Atlanta, GA 30374</p>
                </div>

                <div className="mb-4">
                  <p><strong>RE: Request for Reinvestigation under FCRA</strong></p>
                </div>

                <div className="mb-4">
                  <p>Dear Sir/Madam,</p>
                </div>

                <div className="mb-4">
                  <p>I am disputing the accuracy of the following tradelines appearing on my credit report:</p>
                </div>

                {violations?.slice(0, 2).map((violation, index) => (
                  <div key={violation.id} className="mb-4 bg-gray-50 p-3 rounded border-l-4 border-red-500">
                    <p><strong>Account:</strong> {violation.accountName}</p>
                    <p><strong>Issue:</strong> {violation.violationType}</p>
                    <p><strong>Statutory Basis:</strong> {violation.statute}</p>
                    <p><strong>Details:</strong> {violation.description}</p>
                  </div>
                ))}

                <div className="mb-4">
                  <p>Under the Fair Credit Reporting Act, you are required to conduct a reasonable reinvestigation and either verify the accuracy of this information or delete it from my credit file within 30 days of receipt of this dispute.</p>
                </div>

                <div className="mb-4">
                  <p>Please provide written results of your investigation as required under 15 U.S.C. § 1681i(a)(7).</p>
                </div>

                <div>
                  <p>Sincerely,</p>
                  <br />
                  <p><strong>{user?.firstName} {user?.lastName}</strong></p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CFPB Escalation */}
        <Card data-testid="cfpb-escalation">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Scale className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <CardTitle>CFPB Complaint Packet</CardTitle>
                  <CardDescription>Escalation packet with case law citations</CardDescription>
                </div>
              </div>
              <Button 
                variant="secondary"
                onClick={() => generateCFPBMutation.mutate()}
                disabled={generateCFPBMutation.isPending}
                data-testid="button-generate-cfpb"
              >
                {generateCFPBMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Gavel className="w-4 h-4 mr-2" />
                    Generate CFPB Packet
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Includes:
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Formal complaint letter</li>
                  <li>• All dispute correspondence</li>
                  <li>• Supporting legal citations</li>
                  <li>• Evidence documentation</li>
                  <li>• Timeline of violations</li>
                  <li>• Statutory references</li>
                </ul>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center">
                  <Scale className="w-4 h-4 mr-2" />
                  Case Law Citations:
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Maxey v. Trans Union (2016)</li>
                  <li>• Johnson v. MBNA (2005)</li>
                  <li>• Phillips v. Grendahl (2000)</li>
                  <li>• Cushman v. TransUnion Corp.</li>
                  <li>• Auto-fetched relevant cases</li>
                  <li>• Circuit court decisions</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">When to Use CFPB Escalation</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Use this escalation packet when credit bureaus fail to respond to your initial dispute letters 
                    or provide inadequate investigations. The CFPB has enforcement authority and can compel proper responses.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Letter Generation Help */}
        {(!disputeLetters || disputeLetters.length === 0) && violations && violations.length > 0 && (
          <Card className="mt-6" data-testid="generation-help">
            <CardHeader>
              <CardTitle>Ready to Generate Letters?</CardTitle>
              <CardDescription>
                You have {violations.length} violations that can be disputed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {["EQUIFAX", "TRANSUNION", "EXPERIAN"].map((bureau) => {
                  const bureauViolations = violations.filter(v => v.bureau === bureau);
                  return (
                    <div key={bureau} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">{bureau}</h4>
                      <p className="text-2xl font-bold text-primary mb-2">{bureauViolations.length}</p>
                      <p className="text-sm text-muted-foreground mb-3">violations found</p>
                      <Button 
                        size="sm" 
                        className="w-full"
                        disabled={bureauViolations.length === 0}
                        data-testid={`button-generate-${bureau.toLowerCase()}`}
                      >
                        Generate Letter
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="text-center">
                <Button size="lg" data-testid="button-generate-all">
                  Generate All Letters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
