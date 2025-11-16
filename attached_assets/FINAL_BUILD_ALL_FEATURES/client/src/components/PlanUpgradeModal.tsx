import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlanUpgradeModal({ isOpen, onClose }: PlanUpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // Redirect to subscription page
      window.location.href = "/subscribe";
    } catch (error) {
      toast({
        title: "Upgrade Failed",
        description: "Please try again later.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="upgrade-modal">
        <DialogHeader>
          <DialogTitle>Upgrade to Done-For-You Plan</DialogTitle>
          <DialogDescription>
            Unlock full automation and professional features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pricing */}
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-primary mb-2">$149.99</div>
            <div className="text-sm text-muted-foreground">per month</div>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
              Automated letter mailing via Click2Mail
            </div>
            <div className="flex items-center text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
              CRM integration and progress tracking
            </div>
            <div className="flex items-center text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
              SMS and email notifications
            </div>
            <div className="flex items-center text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
              Priority AI assistant support
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={handleUpgrade}
              disabled={isLoading}
              data-testid="button-proceed-upgrade"
            >
              {isLoading ? "Processing..." : "Upgrade Now"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={onClose}
              disabled={isLoading}
              data-testid="button-cancel-upgrade"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
