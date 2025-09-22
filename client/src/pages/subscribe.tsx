import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscribeForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!stripe || !elements) {
      setIsLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "Welcome to the Done-For-You plan!",
      });
    }
    
    setIsLoading(false);
  };

  return (
    <Card className="max-w-md mx-auto" data-testid="payment-form">
      <CardHeader className="text-center">
        <CardTitle>Complete Your Subscription</CardTitle>
        <CardDescription>
          You're upgrading to the Done-For-You plan for $149.99/month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <PaymentElement />
          <Button 
            type="submit" 
            className="w-full"
            disabled={!stripe || isLoading}
            data-testid="button-complete-payment"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Complete Payment"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Create subscription as soon as the page loads
    apiRequest("POST", "/api/create-subscription")
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
      })
      .catch((error) => {
        toast({
          title: "Error",
          description: "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
        console.error("Subscription error:", error);
      });
  }, [toast]);

  const handleGoBack = () => {
    window.history.back();
  };

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Setting up your subscription...</h3>
            <p className="text-muted-foreground">Please wait while we prepare your payment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-green-500">
      <div className="container mx-auto px-4 py-16">
        
        {/* Header */}
        <div className="text-center text-white mb-8">
          <div className="flex items-center justify-center mb-6">
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/10 mr-4"
              onClick={handleGoBack}
              data-testid="button-go-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Personal Credit Pros</h1>
            </div>
          </div>
          <h2 className="text-xl text-blue-100">
            Upgrade to Done-For-You Plan
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Plan Benefits */}
          <Card className="bg-white/95 backdrop-blur-sm" data-testid="plan-benefits">
            <CardHeader>
              <CardTitle className="text-xl">What's Included</CardTitle>
              <div className="text-3xl font-bold text-primary">$149.99</div>
              <CardDescription>per month</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="flex items-start text-sm">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <div className="font-medium">Everything in DIY Mode</div>
                    <div className="text-muted-foreground text-xs">Credit report analysis and letter generation</div>
                  </div>
                </li>
                <li className="flex items-start text-sm">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <div className="font-medium">Automated Letter Mailing</div>
                    <div className="text-muted-foreground text-xs">We mail your letters via Click2Mail with tracking</div>
                  </div>
                </li>
                <li className="flex items-start text-sm">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <div className="font-medium">CRM Integration & Tracking</div>
                    <div className="text-muted-foreground text-xs">Full case management and progress tracking</div>
                  </div>
                </li>
                <li className="flex items-start text-sm">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <div className="font-medium">SMS & Email Notifications</div>
                    <div className="text-muted-foreground text-xs">Automated reminders and status updates</div>
                  </div>
                </li>
                <li className="flex items-start text-sm">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <div className="font-medium">Priority AI Assistant</div>
                    <div className="text-muted-foreground text-xs">Enhanced support with advanced features</div>
                  </div>
                </li>
                <li className="flex items-start text-sm">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <div className="font-medium">Cancel Anytime</div>
                    <div className="text-muted-foreground text-xs">No long-term contracts or commitments</div>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <div>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <SubscribeForm />
            </Elements>
            
            {/* Security Notice */}
            <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-lg text-white text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Secure Payment</span>
              </div>
              <p className="text-xs text-blue-100">
                Your payment information is encrypted and secure. Powered by Stripe.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-4 text-center">Frequently Asked Questions</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-1">How does automated mailing work?</p>
                <p className="text-blue-100">We send your dispute letters via Click2Mail with certified delivery and tracking numbers.</p>
              </div>
              <div>
                <p className="font-medium mb-1">Can I cancel my subscription?</p>
                <p className="text-blue-100">Yes, you can cancel anytime from your dashboard. No long-term contracts.</p>
              </div>
              <div>
                <p className="font-medium mb-1">What if I need help?</p>
                <p className="text-blue-100">Pro members get priority support and enhanced AI assistance 24/7.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
