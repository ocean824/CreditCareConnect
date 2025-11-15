import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Brain, Mail, CheckCircle } from "lucide-react";

interface OnboardingModalProps {
  open?: boolean;
  onClose?: () => void;
}

export function OnboardingModal({ open: controlledOpen, onClose }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding && controlledOpen === undefined) {
      setOpen(true);
    } else if (controlledOpen !== undefined) {
      setOpen(controlledOpen);
    }
  }, [controlledOpen]);

  const handleClose = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setOpen(false);
    onClose?.();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      localStorage.setItem("hasSeenOnboarding", "true");
      onClose?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="onboarding-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-center">
            👋 Welcome to Personal Credit Pros!
          </DialogTitle>
          <DialogDescription className="text-center text-lg">
            Your AI-powered credit repair automation platform
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
              <FileText className="h-12 w-12 text-blue-600 dark:text-blue-400 mb-3" />
              <h3 className="font-semibold mb-2">Upload Credit Reports</h3>
              <p className="text-sm text-muted-foreground">
                Upload PDF or image credit reports for AI-powered analysis
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950">
              <Brain className="h-12 w-12 text-purple-600 dark:text-purple-400 mb-3" />
              <h3 className="font-semibold mb-2">AI Violation Detection</h3>
              <p className="text-sm text-muted-foreground">
                Automatically detect FCRA and Metro2 compliance violations
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
              <Mail className="h-12 w-12 text-green-600 dark:text-green-400 mb-3" />
              <h3 className="font-semibold mb-2">Automated Mailing</h3>
              <p className="text-sm text-muted-foreground">
                Generate and send dispute letters via Click2Mail integration
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-950">
              <CheckCircle className="h-12 w-12 text-orange-600 dark:bg-orange-400 mb-3" />
              <h3 className="font-semibold mb-2">Track Progress</h3>
              <p className="text-sm text-muted-foreground">
                Monitor dispute rounds, responses, and credit improvements
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border">
            <h4 className="font-semibold mb-2">Getting Started:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Upload your credit report from any bureau (Equifax, Experian, TransUnion)</li>
              <li>Let AI analyze your report and identify potential violations</li>
              <li>Review the generated dispute letters and customize as needed</li>
              <li>Choose to send via Click2Mail or download for manual mailing</li>
              <li>Track responses and iterate on dispute rounds</li>
            </ol>
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={handleClose} size="lg" className="px-8" data-testid="onboarding-close">
            Let's Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
