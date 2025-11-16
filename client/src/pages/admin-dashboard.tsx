import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Users, FileText, Settings, LayoutDashboard } from "lucide-react";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [adminUsername, setAdminUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/check");
      const data = await response.json();

      if (!data.authenticated) {
        setLocation("/admin/login");
        return;
      }

      setAdminUsername(data.username);
    } catch (error) {
      setLocation("/admin/login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
      setLocation("/admin/login");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {adminUsername}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation("/admin/system")}
              data-testid="button-system-dashboard"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              System Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              data-testid="button-admin-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => setLocation("/admin/users")}
                data-testid="button-manage-users"
              >
                Manage Users
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Case Management</CardTitle>
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <CardDescription>
                View and manage all cases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => setLocation("/admin/cases")}
                data-testid="button-manage-cases"
              >
                View Cases
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>System Settings</CardTitle>
                <Settings className="h-8 w-8 text-primary" />
              </div>
              <CardDescription>
                Configure system settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => setLocation("/admin/audit")}
                data-testid="button-view-audit"
              >
                View Audit Logs
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Button
                variant="outline"
                onClick={() => setLocation("/admin/letters")}
                data-testid="button-view-letters"
              >
                View Letters
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/admin/responses")}
                data-testid="button-view-responses"
              >
                View Responses
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/admin/bulk")}
                data-testid="button-bulk-actions"
              >
                Bulk Actions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
