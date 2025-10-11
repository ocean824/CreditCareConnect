import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import AdminOverview from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminCases from "@/pages/admin/cases";
import AdminLetters from "@/pages/admin/letters";
import AdminResponses from "@/pages/admin/responses";
import AdminAudit from "@/pages/admin/audit";
import AdminBulk from "@/pages/admin/bulk";
import AdminCase from "@/pages/admin/case";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/admin" component={AdminOverview} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/cases" component={AdminCases} />
          <Route path="/admin/case/:id" component={AdminCase} />
          <Route path="/admin/letters" component={AdminLetters} />
          <Route path="/admin/responses" component={AdminResponses} />
          <Route path="/admin/audit" component={AdminAudit} />
          <Route path="/admin/bulk" component={AdminBulk} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
