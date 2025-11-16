import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User as UserIcon, FileText, Crown, Save, Mail } from "lucide-react";
import type { User, CreditReport, DisputeLetter } from "@shared/schema";

export default function ProfilePage() {
  const { toast } = useToast();
  
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: creditReports, isLoading: reportsLoading } = useQuery<CreditReport[]>({
    queryKey: ["/api/credit-reports"],
  });

  const { data: disputeLetters, isLoading: lettersLoading } = useQuery<DisputeLetter[]>({
    queryKey: ["/api/dispute-letters"],
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      return await apiRequest("PATCH", "/api/auth/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ firstName, lastName });
  };

  if (userLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const planInfo = {
    DIY: {
      name: "DIY Plan",
      price: "$19.95/month",
      features: ["Credit report analysis", "AI-powered violation detection", "Letter generation", "Self-service tools"],
      color: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    },
    DONE_FOR_YOU: {
      name: "Done-For-You Plan",
      price: "$149.99/month",
      features: ["All DIY features", "Automated certified mail delivery", "Bureau response tracking", "Priority support"],
      color: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
    },
    ENTERPRISE: {
      name: "Enterprise Plan",
      price: "Custom pricing",
      features: ["All Done-For-You features", "Dedicated account manager", "Custom integrations", "White-label options"],
      color: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
    },
  };

  const currentPlan = planInfo[user?.plan as keyof typeof planInfo] || planInfo.DIY;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserIcon className="h-8 w-8" />
            User Profile
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and view your activity
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card data-testid="profile-settings-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Profile Settings
            </CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-gray-50 dark:bg-gray-900"
                data-testid="profile-email"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed (managed by Replit Auth)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={user?.firstName || "Enter first name"}
                data-testid="profile-firstname-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={user?.lastName || "Enter last name"}
                data-testid="profile-lastname-input"
              />
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              className="w-full"
              data-testid="profile-save-btn"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Account Tier */}
        <Card data-testid="account-tier-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Account Tier
            </CardTitle>
            <CardDescription>Your current subscription plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`p-4 rounded-lg ${currentPlan.color} space-y-3`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{currentPlan.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {currentPlan.price}
                </Badge>
              </div>
              
              <Separator className="bg-current opacity-20" />
              
              <div className="space-y-2">
                <p className="font-medium text-sm">Features:</p>
                <ul className="space-y-1">
                  {currentPlan.features.map((feature, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {user?.role === "admin" && (
                <Badge variant="destructive" className="mt-3">
                  Admin Account
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saved Documents */}
      <Card data-testid="saved-documents-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Saved Documents
          </CardTitle>
          <CardDescription>Your uploaded credit reports and generated letters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Credit Reports */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                Credit Reports ({creditReports?.length || 0})
              </h4>
              {reportsLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : creditReports && creditReports.length > 0 ? (
                <ul className="space-y-2 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  {creditReports.slice(0, 5).map((report: any) => (
                    <li
                      key={report.id}
                      className="flex items-center justify-between text-sm"
                      data-testid={`saved-report-${report.id}`}
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        {report.fileName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {report.bureau || "Unknown"}
                      </Badge>
                    </li>
                  ))}
                  {creditReports.length > 5 && (
                    <li className="text-xs text-muted-foreground pt-2">
                      ... and {creditReports.length - 5} more
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  No credit reports uploaded yet
                </p>
              )}
            </div>

            <Separator />

            {/* Dispute Letters */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                Dispute Letters ({disputeLetters?.length || 0})
              </h4>
              {lettersLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : disputeLetters && disputeLetters.length > 0 ? (
                <ul className="space-y-2 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  {disputeLetters.slice(0, 5).map((letter: any) => (
                    <li
                      key={letter.id}
                      className="flex items-center justify-between text-sm"
                      data-testid={`saved-letter-${letter.id}`}
                    >
                      <span className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-purple-500" />
                        {letter.letterType} - {letter.bureau}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {letter.status}
                      </Badge>
                    </li>
                  ))}
                  {disputeLetters.length > 5 && (
                    <li className="text-xs text-muted-foreground pt-2">
                      ... and {disputeLetters.length - 5} more
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  No dispute letters generated yet
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
