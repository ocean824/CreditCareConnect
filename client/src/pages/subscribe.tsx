import { useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Subscribe() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoadingDIY, setIsLoadingDIY] = useState(false);
  const [isLoadingPro, setIsLoadingPro] = useState(false);

  const handleSelectPlan = async (plan: 'DIY' | 'DONE_FOR_YOU') => {
    // Check if user is authenticated
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to subscribe to a plan.",
        variant: "default",
      });
      // Store the selected plan in session storage to restore after login
      sessionStorage.setItem('selectedPlan', plan);
      window.location.href = '/?action=login';
      return;
    }

    const setLoading = plan === 'DIY' ? setIsLoadingDIY : setIsLoadingPro;
    setLoading(true);

    try {
      const response = await apiRequest("POST", "/api/create-checkout-session", {
        plan,
        successUrl: `${window.location.origin}/dashboard?upgrade=success`,
        cancelUrl: `${window.location.origin}/subscribe?canceled=true`,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      toast({
        title: "Redirecting to checkout...",
        description: "Please complete your payment with Stripe",
      });

      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-green-500">
      <div className="container mx-auto px-4 py-16">
        
        {/* Header */}
        <div className="text-center text-white mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mr-3">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Personal Credit Pros</h1>
          </div>
          <h2 className="text-2xl mb-3">AI-Powered Credit Repair Platform</h2>
          <p className="text-blue-100 max-w-2xl mx-auto">
            Fix Your Credit Score with Professional Dispute Letters
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          
          {/* DIY Plan */}
          <Card className="bg-white relative" data-testid="card-plan-diy">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-2xl mb-2">DIY Mode</CardTitle>
              <div className="text-4xl font-bold text-primary mb-2">$19.95</div>
              <CardDescription className="text-base">per month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Credit report upload & AI analysis</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">AI-generated dispute letters</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">PDF download & print</span>
                </li>
                <li className="flex items-start">
                  <X className="w-5 h-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Manual mailing required</span>
                </li>
              </ul>
              
              <Button 
                className="w-full"
                onClick={() => handleSelectPlan('DIY')}
                disabled={isLoadingDIY}
                data-testid="button-choose-diy"
              >
                {isLoadingDIY ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Start DIY Plan"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Done-For-You Plan */}
          <Card className="bg-white relative border-primary border-2" data-testid="card-plan-pro">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </span>
            </div>
            <CardHeader className="text-center pb-8 pt-8">
              <CardTitle className="text-2xl mb-2">Done-For-You</CardTitle>
              <div className="text-4xl font-bold text-primary mb-2">$149.99</div>
              <CardDescription className="text-base">per month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Everything in DIY</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Auto-mail Certified Letters</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">CRM integration & tracking</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">SMS & email notifications</span>
                </li>
              </ul>
              
              <Button 
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => handleSelectPlan('DONE_FOR_YOU')}
                disabled={isLoadingPro}
                data-testid="button-choose-pro"
              >
                {isLoadingPro ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Start Pro Plan"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="bg-white" data-testid="card-plan-enterprise">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-2xl mb-2">Enterprise</CardTitle>
              <div className="text-4xl font-bold text-primary mb-2">Custom</div>
              <CardDescription className="text-base">For credit repair businesses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Everything in Pro</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Multiple clients</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">White-label options</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Dedicated support</span>
                </li>
              </ul>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.location.href = 'mailto:sales@personalcreditpros.com'}
                data-testid="button-contact-sales"
              >
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Why Choose Section */}
        <div className="max-w-4xl mx-auto mt-16 text-white text-center">
          <h3 className="text-2xl font-bold mb-8">Why Choose Personal Credit Pros?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-4xl mb-4">🤖</div>
              <h4 className="font-semibold mb-2">AI-Powered Analysis</h4>
              <p className="text-sm text-blue-100">Advanced AI scans for Metro2 and FCRA violations</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-4xl mb-4">⚖️</div>
              <h4 className="font-semibold mb-2">Legal Compliance</h4>
              <p className="text-sm text-blue-100">Letters cite FCRA, FDCPA, and case law</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-4xl mb-4">📈</div>
              <h4 className="font-semibold mb-2">Proven Results</h4>
              <p className="text-sm text-blue-100">Automated follow-ups and tracking</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
