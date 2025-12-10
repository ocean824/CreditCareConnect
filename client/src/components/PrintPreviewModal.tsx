import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText, X, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  document?: {
    id?: string;
    filename: string;
    recipient?: string;
    sender?: string;
    pages?: number;
    content?: string;
  };
  onSendToClick2Mail?: () => void;
}

export function PrintPreviewModal({ 
  open, 
  onClose, 
  document,
  onSendToClick2Mail
}: PrintPreviewModalProps) {
  const { toast } = useToast();

  const handlePrint = () => {
    toast({
      title: "Print dialog",
      description: "Opening print dialog...",
    });
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!document?.id) {
      toast({
        title: "Download failed",
        description: "No document available to download.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Downloading...",
      description: "Generating your Word document.",
    });
    
    try {
      const response = await fetch(`/api/dispute-letters/${document.id}/download`, { 
        credentials: 'include' 
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(errorData.message || 'Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.filename || 'Dispute_Letter.docx';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Document downloaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Could not download document.",
        variant: "destructive",
      });
    }
  };

  const handleSendToClick2Mail = () => {
    toast({
      title: "Sending to Click2Mail",
      description: "Your document is being sent for physical mailing.",
    });
    onSendToClick2Mail?.();
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col" data-testid="print-preview-modal">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
              <Printer className="h-6 w-6" />
              Print Preview
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="print-preview-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Preview Area */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-12 min-h-[800px]">
              {/* Document Header */}
              <div className="mb-8">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <p><strong>From:</strong> {document?.sender || "Personal Credit Pros"}</p>
                  <p><strong>To:</strong> {document?.recipient || "Credit Bureau"}</p>
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Document Content */}
              <div className="prose dark:prose-invert max-w-none">
                <h2 className="text-xl font-bold mb-4">{document?.filename || "Dispute Letter"}</h2>
                
                {document?.content ? (
                  <div className="whitespace-pre-wrap">{document.content}</div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <p>Dear Credit Bureau,</p>
                    <p>
                      I am writing to dispute the following information in my file. The items I dispute are
                      also encircled on the attached copy of my credit report.
                    </p>
                    <p>
                      This item is inaccurate or incomplete. I am requesting that the item be removed or
                      corrected to reflect accurate information.
                    </p>
                    <p>
                      Enclosed are copies of supporting documents to support my position. Please reinvestigate
                      this matter and correct or delete the disputed item as soon as possible.
                    </p>
                    <p>Sincerely,</p>
                    <p className="mt-8">[Your Name]<br/>[Your Address]</p>
                  </div>
                )}
              </div>

              {/* Page Footer */}
              <div className="mt-12 pt-4 border-t text-center text-sm text-gray-500">
                Page 1 of {document?.pages || 1}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border">
              <h3 className="font-semibold mb-3">Document Info</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Document:</span>
                  <p className="font-medium">{document?.filename || "Dispute Letter"}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Pages:</span>
                  <p className="font-medium">{document?.pages || 1}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Recipient:</span>
                  <p className="font-medium">{document?.recipient || "Credit Bureau"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleSendToClick2Mail}
                className="w-full"
                size="lg"
                data-testid="send-to-click2mail"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send via Click2Mail
              </Button>

              <Button
                onClick={handlePrint}
                variant="outline"
                className="w-full"
                size="lg"
                data-testid="print-button"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Document
              </Button>

              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                className="w-full"
                size="lg"
                data-testid="download-word-doc"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Word Doc
              </Button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Tip</p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Sending via Click2Mail will mail this document using certified mail with tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
