import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, FileText, Zap } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-green-500">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center text-white mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mr-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold">Personal Credit Pros</h1>
          </div>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            AI-Powered Credit Repair Platform - Fix Your Credit Score with Professional Dispute Letters
          </p>
        </div>

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {/* DIY Plan */}
          <Card className="bg-white/95 backdrop-blur-sm" data-testid="plan-diy">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">DIY Mode</CardTitle>
              <div className="text-3xl font-bold text-muted-foreground">$19.95</div>
              <CardDescription>per month</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  Credit report upload & AI analysis
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  AI-generated dispute letters
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  PDF download & print
                </li>
                <li className="flex items-center text-sm text-muted-foreground">
                  <span className="w-4 h-4 mr-3">×</span>
                  Manual mailing required
                </li>
              </ul>
              <Button 
                className="w-full" 
                onClick={handleLogin}
                data-testid="button-start-free"
              >
                Start DIY Plan
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="bg-white/95 backdrop-blur-sm border-primary border-2 relative" data-testid="plan-pro">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </span>
            </div>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Done-For-You</CardTitle>
              <div className="text-3xl font-bold text-primary">$149.99</div>
              <CardDescription>per month</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  Everything in DIY
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  Auto-mail Certified Letters
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  CRM integration & tracking
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  SMS & email notifications
                </li>
              </ul>
              <Button 
                className="w-full" 
                onClick={handleLogin}
                data-testid="button-start-pro"
              >
                Start Pro Plan
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="bg-white/95 backdrop-blur-sm" data-testid="plan-enterprise">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Enterprise</CardTitle>
              <div className="text-3xl font-bold text-muted-foreground">Custom</div>
              <CardDescription>For credit repair businesses</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  Everything in Pro
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  Multiple clients
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  White-label options
                </li>
                <li className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                  Dedicated support
                </li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full bg-white"
                data-testid="button-contact-sales"
              >
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Why Choose Personal Credit Pros?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center text-white" data-testid="feature-ai">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI-Powered Analysis</h3>
              <p className="text-blue-100 text-sm">
                Advanced AI detects Metro2 and FCRA violations automatically
              </p>
            </div>

            <div className="text-center text-white" data-testid="feature-letters">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Legal Dispute Letters</h3>
              <p className="text-blue-100 text-sm">
                Professionally crafted letters with proper legal citations
              </p>
            </div>

            <div className="text-center text-white" data-testid="feature-automation">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Full Automation</h3>
              <p className="text-blue-100 text-sm">
                Automated mailing, tracking, and follow-up reminders
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Button 
            size="lg" 
            className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg font-semibold"
            onClick={handleLogin}
            data-testid="button-get-started-main"
          >
            Get Started Today
          </Button>
          <p className="text-white/80 text-sm mt-4">
            Start improving your credit score today
          </p>
          
          {/* Sign In for Existing Users */}
          <div className="mt-8">
            <p className="text-white/70 text-sm mb-3">
              Already have an account?
            </p>
            <Button 
              variant="outline"
              size="lg"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:border-white/50 px-8 py-3"
              onClick={handleLogin}
              data-testid="button-sign-in"
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Admin Link */}
        <div className="text-center mt-12 pb-8">
          <a
            href="/admin/login"
            className="text-white/60 hover:text-white/90 text-xs underline underline-offset-4 transition-colors"
            data-testid="link-admin"
          >
            Admin Access
          </a>
        </div>
      </div>
    </div>
  );
}
