import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, FileText, Mail, Upload, History, LayoutDashboard, Zap } from "lucide-react";

export default function AdminNav() {
  const [location] = useLocation();

  const tabs = [
    { path: "/admin", label: "Overview", icon: LayoutDashboard },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/cases", label: "Cases", icon: FileText },
    { path: "/admin/letters", label: "Letters", icon: Mail },
    { path: "/admin/responses", label: "Responses", icon: Upload },
    { path: "/admin/audit", label: "Audit", icon: History },
    { path: "/admin/bulk", label: "Bulk Actions", icon: Zap },
  ];

  return (
    <div className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-2 py-3 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location === tab.path;
            
            return (
              <Link key={tab.path} href={tab.path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                  data-testid={`admin-tab-${tab.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
