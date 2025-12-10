import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import { PrintPreviewModal } from "@/components/PrintPreviewModal";
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
import type { DisputeLetter, Violation } from "@shared/schema";

export default function Letters() {
  const { user, isLoading } = useAuth();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: disputeLetters } = useQuery<DisputeLetter[]>({
    queryKey: ["/api/dispute-letters"],
    enabled: !!user,
  });

  const { data: violations } = useQuery<Violation[]>({
    queryKey: ["/api/violations"],
    enabled: !!user,
  });

  const [generatingBureau, setGeneratingBureau] = useState<string | null>(null);

  const generateLetterMutation = useMutation({
    mutationFn: async ({ bureau, violationIds }: { bureau: string; violationIds: string[] }) => {
      const response = await apiRequest("POST", "/api/dispute-letters/generate", {
        bureau,
        violationIds,
        round: 1,
        recipientType: 'BUREAU'
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Letter Generated",
        description: `Dispute letter for ${data.bureau} has been created.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dispute-letters"] });
      setGeneratingBureau(null);
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate letter",
        variant: "destructive",
      });
      setGeneratingBureau(null);
    },
  });

  const handleGenerateLetter = (bureau: string) => {
    const bureauViolations = violations?.filter(v => v.bureau === bureau) || [];
    if (bureauViolations.length === 0) {
      toast({
        title: "No Violations",
        description: `No violations found for ${bureau}`,
        variant: "destructive",
      });
      return;
    }
    setGeneratingBureau(bureau);
    generateLetterMutation.mutate({
      bureau,
      violationIds: bureauViolations.map(v => v.id)
    });
  };

  const handleGenerateAllLetters = async () => {
    const bureaus = ["EQUIFAX", "TRANSUNION", "EXPERIAN"];
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const bureau of bureaus) {
        const bureauViolations = violations?.filter(v => v.bureau === bureau) || [];
        if (bureauViolations.length > 0) {
          setGeneratingBureau(bureau);
          try {
            await generateLetterMutation.mutateAsync({
              bureau,
              violationIds: bureauViolations.map(v => v.id)
            });
            successCount++;
          } catch (e) {
            errorCount++;
          }
        }
      }
      
      if (successCount > 0) {
        toast({
          title: "Letters Generated",
          description: `Generated ${successCount} dispute letter${successCount > 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        });
      }
    } finally {
      setGeneratingBureau(null);
    }
  };

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
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate CFPB packet",
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

  const handleDownloadLetter = async (letterId: string) => {
    window.alert(`DOWNLOAD CLICKED - Letter ID: ${letterId}`);
    
    const letter = disputeLetters?.find(l => l.id === letterId);
    window.alert(`Letter found: ${!!letter}, Has PDF: ${!!letter?.pdfUrl}`);
    
    if (!letter || !letter.pdfUrl) {
      window.alert('ERROR: Letter or pdfUrl missing');
      return;
    }
    
    try {
      window.alert(`Fetching: /api/dispute-letters/${letterId}/download`);
      const response = await fetch(`/api/dispute-letters/${letterId}/download`, { credentials: 'include' });
      window.alert(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Download failed: ${response.status} - ${errorText}`);
      }
      
      const blob = await response.blob();
      window.alert(`Blob received: ${blob.size} bytes`);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${letter.bureau}_Letter.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      window.alert('Download completed successfully!');
    } catch (error: any) {
      window.alert(`Download ERROR: ${error.message}`);
    }
  };

  const handlePreviewLetter = (letterId: string) => {
    window.alert(`PREVIEW CLICKED - Letter ID: ${letterId}`);
    
    const letter = disputeLetters?.find(l => l.id === letterId);
    window.alert(`Letter found: ${!!letter}`);
    
    if (!letter) {
      window.alert('ERROR: Letter not found');
      return;
    }
    
    setSelectedLetter(letterId);
    setPreviewDocument({ id: letter.id, content: letter.content });
    setShowPrintPreview(true);
    
    window.alert('Preview modal should now be visible');
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
      <PrintPreviewModal 
        open={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        document={previewDocument}
        onSendToClick2Mail={() => {
          toast({
            title: "Sent to Click2Mail",
            description: "Your dispute letter has been sent for physical mailing.",
          });
        }}
      />
      
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
                  <button 
                    type="button"
                    style={{
                      width: '100%',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onClick={() => handleDownloadLetter(letter.id)}
                    data-testid={`button-download-${letter.bureau.toLowerCase()}`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Word Doc
                  </button>
                  <button 
                    type="button"
                    style={{
                      width: '100%',
                      backgroundColor: 'white',
                      color: '#333',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      cursor: 'pointer',
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    onClick={() => {
                      setSelectedLetter(letter.id);
                      handlePreviewLetter(letter.id);
                    }}
                    data-testid={`button-preview-${letter.bureau.toLowerCase()}`}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Letter
                  </button>
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
                  <Button variant="outline" data-testid="button-go-to-analysis" onClick={() => window.location.href = '/analysis'}>
                    Go to Analysis
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Letter Preview Section */}
        {selectedLetter && disputeLetters && (
          <Card className="mb-8" data-testid="letter-preview">
            <CardHeader>
              <CardTitle>Letter Preview</CardTitle>
              <CardDescription>
                Preview of your generated dispute letter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white border border-gray-300 rounded-lg p-6 font-mono text-sm leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
                {disputeLetters.find(l => l.id === selectedLetter)?.content || "No content available"}
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
                <p className="text-sm text-muted-foreground">
                  Case law citations will be automatically included when you generate the CFPB packet based on your specific violations and legal grounds.
                </p>
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
                        disabled={bureauViolations.length === 0 || generatingBureau !== null}
                        onClick={() => handleGenerateLetter(bureau)}
                        data-testid={`button-generate-${bureau.toLowerCase()}`}
                      >
                        {generatingBureau === bureau ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate Letter'
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="text-center">
                <Button 
                  size="lg" 
                  disabled={generatingBureau !== null}
                  onClick={handleGenerateAllLetters}
                  data-testid="button-generate-all"
                >
                  {generatingBureau !== null ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating {generatingBureau}...
                    </>
                  ) : (
                    'Generate All Letters'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
