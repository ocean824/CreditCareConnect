import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import type { User } from "@shared/schema";

interface NavigationProps {
  user?: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Navigation({ user, activeTab, onTabChange }: NavigationProps) {
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50" data-testid="navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Personal Credit Pros</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <Button
              variant={activeTab === "dashboard" ? "default" : "ghost"}
              onClick={() => onTabChange("dashboard")}
              data-testid="tab-dashboard"
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === "analysis" ? "default" : "ghost"}
              onClick={() => onTabChange("analysis")}
              data-testid="tab-analysis"
            >
              Analysis
            </Button>
            <Button
              variant={activeTab === "letters" ? "default" : "ghost"}
              onClick={() => onTabChange("letters")}
              data-testid="tab-letters"
            >
              Letters
            </Button>
            {user?.email?.includes('admin') && (
              <Button
                variant={activeTab === "admin" ? "default" : "ghost"}
                onClick={() => onTabChange("admin")}
                data-testid="tab-admin"
              >
                Admin
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <span className="text-xs font-medium">
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-sm font-medium" data-testid="text-user-email">
                {user?.email || 'user@example.com'}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
