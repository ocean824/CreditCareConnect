import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import UserLogin from "@/pages/user-login";
import UserRegister from "@/pages/user-register";
import Dashboard from "@/pages/dashboard";
import ProfilePage from "@/pages/profile";
import Analysis from "@/pages/analysis";
import Letters from "@/pages/letters";
import Subscribe from "@/pages/subscribe";
import AdminOverview from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminCases from "@/pages/admin/cases";
import AdminLetters from "@/pages/admin/letters";
import AdminResponses from "@/pages/admin/responses";
import AdminAudit from "@/pages/admin/audit";
import AdminBulk from "@/pages/admin/bulk";
import AdminCase from "@/pages/admin/case";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminSystemDashboard from "@/pages/admin-system-dashboard";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasActiveSubscription = user?.subscriptionStatus === "active";

  return (
    <Switch>
      <Route path="/login" component={UserLogin} />
      <Route path="/register" component={UserRegister} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/system" component={AdminSystemDashboard} />
      <Route path="/subscribe" component={Subscribe} />
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : !hasActiveSubscription ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/dashboard" component={Landing} />
          <Route component={Landing} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/analysis" component={Analysis} />
          <Route path="/letters" component={Letters} />
          <Route path="/upload" component={Dashboard} />
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
  // Clear ALL browser caches on app mount - aggressive cache clearing
  useEffect(() => {
    const clearAllCaches = async () => {
      // Clear React Query cache
      queryClient.clear();
      
      // Clear localStorage
      try {
        localStorage.clear();
      } catch (e) {
        console.warn("Could not clear localStorage:", e);
      }
      
      // Clear sessionStorage
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn("Could not clear sessionStorage:", e);
      }
      
      // Clear IndexedDB (used by some caching libraries)
      if (indexedDB) {
        try {
          const dbs = await indexedDB.databases?.() || [];
          for (const db of dbs) {
            indexedDB.deleteDatabase(db.name);
          }
        } catch (e) {
          console.warn("Could not clear IndexedDB:", e);
        }
      }
      
      // Clear service worker cache
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            registration.unregister();
          }
          // Clear all cache storage
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
          }
        } catch (e) {
          console.warn("Could not clear service worker cache:", e);
        }
      }
      
      console.log("✅ All caches cleared on app startup");
    };
    
    clearAllCaches();
  }, []);

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
