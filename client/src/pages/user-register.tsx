import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function UserRegister() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [plan, setPlan] = useState("DIY");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/user/register", {
        email,
        password,
        firstName,
        lastName,
        plan,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      const isSpecialUser = email.toLowerCase() === "jarred@anunlimitedllc.com";

      toast({
        title: "Registration Successful",
        description: isSpecialUser
          ? "Welcome! Your enterprise account is ready."
          : "Your account has been created. Please subscribe to access the platform.",
      });

      if (isSpecialUser) {
        setLocation("/dashboard");
      } else {
        toast({
          title: "Subscription Required",
          description: "Redirecting you to select a subscription plan...",
        });
        setTimeout(() => {
          setLocation("/");
        }, 2000);
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Unable to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-green-500 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center text-white mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mr-3">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Personal Credit Pros</h1>
          </div>
          <p className="text-blue-100">Create your account to get started</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Sign up to start improving your credit score</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    data-testid="input-first-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="input-confirm-password"
                />
              </div>

              <div className="space-y-2">
                <Label>Select Plan (you can change this later)</Label>
                <RadioGroup value={plan} onValueChange={setPlan}>
                  <div className="flex items-center space-x-2 border rounded-lg p-3">
                    <RadioGroupItem value="DIY" id="diy" data-testid="radio-plan-diy" />
                    <Label htmlFor="diy" className="flex-1 cursor-pointer">
                      <div className="font-semibold">DIY Mode - $19.95/month</div>
                      <div className="text-sm text-muted-foreground">
                        AI analysis and letter generation
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 border rounded-lg p-3 border-primary">
                    <RadioGroupItem value="DONE_FOR_YOU" id="pro" data-testid="radio-plan-pro" />
                    <Label htmlFor="pro" className="flex-1 cursor-pointer">
                      <div className="font-semibold">Done-For-You - $149.99/month</div>
                      <div className="text-sm text-muted-foreground">
                        Everything in DIY + automated mailing
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 border rounded-lg p-3">
                    <RadioGroupItem
                      value="ENTERPRISE"
                      id="enterprise"
                      data-testid="radio-plan-enterprise"
                    />
                    <Label htmlFor="enterprise" className="flex-1 cursor-pointer">
                      <div className="font-semibold">Enterprise - Custom Pricing</div>
                      <div className="text-sm text-muted-foreground">
                        For credit repair businesses
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="text-primary hover:underline font-medium"
                  data-testid="link-login"
                >
                  Sign in
                </a>
              </p>
            </div>

            <div className="mt-4 text-center">
              <a
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground"
                data-testid="link-back-home"
              >
                ← Back to home
              </a>
            </div>
          </CardContent>
        </Card>

        <p className="text-white/70 text-xs text-center mt-4">
          After registration, you'll need to subscribe to access the platform.
        </p>
      </div>
    </div>
  );
}
