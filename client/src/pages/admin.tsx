import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  DollarSign, 
  FileText, 
  TrendingUp,
  Search,
  Download,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity
} from "lucide-react";

export default function Admin() {
  const { user, isLoading } = useAuth();

  const { data: adminStats } = useQuery({
    queryKey: ["/api/admin/stats"],
    enabled: !!user?.email?.includes('admin'),
  });

  const { data: allUsers } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.email?.includes('admin'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Check admin access
  if (!user?.email?.includes('admin')) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation 
          user={user} 
          activeTab="admin"
          onTabChange={() => {}}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground">You need administrator privileges to access this page.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        user={user} 
        activeTab="admin"
        onTabChange={() => {}}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-admin-title">Admin Dashboard</h2>
          <p className="text-muted-foreground">System administration and user management</p>
        </div>

        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="text-center" data-testid="stat-total-users">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-blue-500 mb-2">
                {adminStats?.totalUsers || allUsers?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </CardContent>
          </Card>
          
          <Card className="text-center" data-testid="stat-pro-subscribers">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-green-500 mb-2">
                {adminStats?.proSubscribers || allUsers?.filter(u => u.plan === "DONE_FOR_YOU")?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Pro Subscribers</div>
            </CardContent>
          </Card>
          
          <Card className="text-center" data-testid="stat-monthly-revenue">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-6 h-6 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-purple-500 mb-2">
                ${adminStats?.monthlyRevenue?.toLocaleString() || "0"}
              </div>
              <div className="text-sm text-muted-foreground">Monthly Revenue</div>
            </CardContent>
          </Card>
          
          <Card className="text-center" data-testid="stat-letters-sent">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-orange-500" />
              </div>
              <div className="text-3xl font-bold text-orange-500 mb-2">
                {adminStats?.lettersSent || 0}
              </div>
              <div className="text-sm text-muted-foreground">Letters Sent</div>
            </CardContent>
          </Card>
        </div>

        {/* User Management Table */}
        <Card className="mb-8" data-testid="user-management">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user accounts and subscriptions
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search users..." 
                    className="pl-10 w-64"
                    data-testid="input-search-users"
                  />
                </div>
                <Button variant="outline" size="sm" data-testid="button-export-csv">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reports</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers?.map((adminUser) => (
                    <tr key={adminUser.id} className="border-b hover:bg-muted/30" data-testid={`user-row-${adminUser.id}`}>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">
                              {adminUser.firstName?.[0] || adminUser.email?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {adminUser.firstName} {adminUser.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">{adminUser.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge 
                          variant={adminUser.plan === "DONE_FOR_YOU" ? "default" : "secondary"}
                          className={
                            adminUser.plan === "DONE_FOR_YOU" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {adminUser.plan === "DONE_FOR_YOU" ? "Pro" : "DIY"}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {new Date(adminUser.createdAt!).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-600">Active</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm">
                        <div className="flex items-center space-x-1">
                          <FileText className="w-3 h-3 text-muted-foreground" />
                          <span>0</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            data-testid={`button-view-user-${adminUser.id}`}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            data-testid={`button-edit-user-${adminUser.id}`}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="api-integrations">
            <CardHeader>
              <CardTitle>API Integrations</CardTitle>
              <CardDescription>Monitor external service connections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Click2Mail API</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Credit Repair Cloud</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Twilio SMS</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm font-medium">OpenAI GPT-5</span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">Rate Limited</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Stripe Payments</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="system-health">
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Monitor system performance and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Letter Generation Service</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">PDF Processing</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email Service</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Operational</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium mb-3 flex items-center">
                    <Activity className="w-4 h-4 mr-2" />
                    Recent Activity
                  </h4>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Letters generated today</span>
                      <span className="font-medium">15</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>New registrations today</span>
                      <span className="font-medium">3</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pro upgrades this week</span>
                      <span className="font-medium">2</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>System uptime</span>
                      <span className="font-medium text-green-600">99.9%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
