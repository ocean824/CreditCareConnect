import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, FileText, Zap, Shield, Sparkles } from "lucide-react";

export default function Landing() {
  const handleGetStarted = () => {
    window.location.href = "/register";
  };

  const handleSignIn = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-green-500">
      <div className="container mx-auto px-4 py-8">
        {/* Top Navigation */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Personal Credit Pros</h1>
          </div>
          <Button
            variant="outline"
            className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:border-white/50"
            onClick={handleSignIn}
            data-testid="button-sign-in-header"
          >
            Sign In
          </Button>
        </div>

        {/* Hero Section */}
        <div className="text-center text-white mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Fix Your Credit Score with AI
          </h2>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Professional dispute letters powered by artificial intelligence to help you repair your credit
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
                onClick={handleGetStarted}
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
                onClick={handleGetStarted}
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

        {/* Unique Rule Sets Section */}
        <div className="bg-white rounded-2xl p-8 max-w-5xl mx-auto mb-12 shadow-2xl" data-testid="section-unique-rules">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-4">
              <Sparkles className="w-4 h-4" />
              UNIQUE TO PERSONAL CREDIT PROS
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              11 Advanced Violation Detection Rule Sets
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our proprietary AI engine runs 11 comprehensive rule sets to find every possible violation in your credit report — more than any other service on the market.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4" data-testid="rule-balance">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Balance Rules</span>
                <p className="text-xs text-gray-500">Detects balance reporting errors</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4" data-testid="rule-status">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Status Rules</span>
                <p className="text-xs text-gray-500">Finds account status conflicts</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4" data-testid="rule-timeline">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Timeline Rules</span>
                <p className="text-xs text-gray-500">Catches date inconsistencies</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4" data-testid="rule-collection">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Collection Rules</span>
                <p className="text-xs text-gray-500">Identifies collection violations</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4" data-testid="rule-identity">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Identity Rules</span>
                <p className="text-xs text-gray-500">Spots identity discrepancies</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4" data-testid="rule-dispute">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Dispute Rules</span>
                <p className="text-xs text-gray-500">Tracks dispute response issues</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4" data-testid="rule-fcra-enhanced">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Enhanced FCRA Rules</span>
                <p className="text-xs text-gray-500">Advanced statute detection</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4" data-testid="rule-disputable">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Disputable Item Detection</span>
                <p className="text-xs text-gray-500">Finds all challengeable items</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-4" data-testid="rule-fcra-comprehensive">
              <Shield className="w-6 h-6 text-purple-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Comprehensive FCRA</span>
                <p className="text-xs text-gray-500">Full Fair Credit Reporting Act</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-4" data-testid="rule-fdcpa">
              <Shield className="w-6 h-6 text-purple-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Comprehensive FDCPA</span>
                <p className="text-xs text-gray-500">Debt collection law violations</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-4" data-testid="rule-metro2">
              <Shield className="w-6 h-6 text-purple-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-900">Comprehensive Metro2</span>
                <p className="text-xs text-gray-500">Credit reporting format errors</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-6 py-3">
              <span className="text-2xl font-bold text-primary">60+</span>
              <span className="text-gray-700 text-sm">Violation Types Detected Automatically</span>
            </div>
          </div>
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
            onClick={handleGetStarted}
            data-testid="button-get-started-main"
          >
            Get Started Today
          </Button>
          <p className="text-white/80 text-sm mt-4">
            Start improving your credit score today
          </p>
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
