import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import { NotificationsMenu } from "@/components/notifications-menu";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Moderation from "@/pages/moderation";
import Servers from "@/pages/servers";
import ServerSettings from "@/pages/server-settings";
import Bans from "@/pages/bans";
import Appeals from "@/pages/appeals";
import Tickets from "@/pages/tickets";
import Settings from "@/pages/settings";
import Docs from "@/pages/docs";
import Pricing from "@/pages/pricing";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Legal from "@/pages/legal";
import Reports from "@/pages/reports";
import ReportsSettings from "@/pages/reports-settings";
import AppealsSettings from "@/pages/appeals-settings";
import ApiKeys from "@/pages/api-keys";
import Bots from "@/pages/bots";
import TeamMembers from "@/pages/team-members";
import AutoActions from "@/pages/auto-actions";
import Onboarding from "@/pages/onboarding";
import TicketSetup from "@/pages/ticket-setup";
import AcceptInvite from "@/pages/accept-invite";
import Insights from "@/pages/insights";
import Logs from "@/pages/logs";
import UserSearch from "@/pages/user-search";
import BotCommands from "@/pages/bot-commands";
import Help from "@/pages/help";
import GameProfile from "@/pages/game-profile";
import PublicGameProfile from "@/pages/public-game-profile";
import Branding from "@/pages/branding";
import Marketplace from "@/pages/marketplace";
import MarketplacePublic from "@/pages/marketplace-public";
import MarketplaceListing from "@/pages/marketplace-listing";
import MarketplaceCreate from "@/pages/marketplace-create";
import MarketplaceSeller from "@/pages/marketplace-seller";
import Changelog from "@/pages/changelog";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import type { User, Server as ServerType } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { connectWebSocket, disconnectWebSocket } from "./lib/websocket";
import { useEffect } from "react";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: servers = [], isLoading: serversLoading } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
    enabled: !!user,
  });

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (user) {
      connectWebSocket();
      return () => {
        disconnectWebSocket();
      };
    }
  }, [user]);

  // Handle authentication redirect
  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/api/auth/discord";
    }
  }, [isLoading, user]);

  // Handle onboarding redirect
  useEffect(() => {
    if (user && !user.onboardingCompleted && location !== "/onboarding") {
      setLocation("/onboarding");
    } else if (user && user.onboardingCompleted && location === "/onboarding") {
      // If already completed onboarding, redirect away from onboarding page
      setLocation("/dashboard");
    }
  }, [user, location, setLocation]);

  if (isLoading || serversLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <NotificationsMenu />
              <UserAvatarMenu user={user} />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/docs" component={Docs} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/legal" component={Legal} />
      <Route path="/invite/:code" component={AcceptInvite} />
      
      {/* Authenticated routes - all others */}
      <Route path="/dashboard">
        <AuthenticatedLayout><Dashboard /></AuthenticatedLayout>
      </Route>
      <Route path="/moderation">
        <AuthenticatedLayout><Moderation /></AuthenticatedLayout>
      </Route>
      <Route path="/user-search">
        <AuthenticatedLayout><UserSearch /></AuthenticatedLayout>
      </Route>
      <Route path="/bans">
        <AuthenticatedLayout><Bans /></AuthenticatedLayout>
      </Route>
      <Route path="/appeals">
        <AuthenticatedLayout><Appeals /></AuthenticatedLayout>
      </Route>
      <Route path="/tickets">
        <AuthenticatedLayout><Tickets /></AuthenticatedLayout>
      </Route>
      <Route path="/servers/:id">
        <AuthenticatedLayout><ServerSettings /></AuthenticatedLayout>
      </Route>
      <Route path="/servers">
        <AuthenticatedLayout><Servers /></AuthenticatedLayout>
      </Route>
      <Route path="/reports">
        <AuthenticatedLayout><Reports /></AuthenticatedLayout>
      </Route>
      <Route path="/reports-settings">
        <AuthenticatedLayout><ReportsSettings /></AuthenticatedLayout>
      </Route>
      <Route path="/appeals-settings">
        <AuthenticatedLayout><AppealsSettings /></AuthenticatedLayout>
      </Route>
      <Route path="/settings">
        <AuthenticatedLayout><Settings /></AuthenticatedLayout>
      </Route>
      <Route path="/api-keys">
        <AuthenticatedLayout><ApiKeys /></AuthenticatedLayout>
      </Route>
      <Route path="/bots">
        <AuthenticatedLayout><Bots /></AuthenticatedLayout>
      </Route>
      <Route path="/team-members">
        <AuthenticatedLayout><TeamMembers /></AuthenticatedLayout>
      </Route>
      <Route path="/auto-actions">
        <AuthenticatedLayout><AutoActions /></AuthenticatedLayout>
      </Route>
      <Route path="/ticket-setup">
        <AuthenticatedLayout><TicketSetup /></AuthenticatedLayout>
      </Route>
      <Route path="/onboarding">
        <AuthenticatedLayout><Onboarding /></AuthenticatedLayout>
      </Route>
      <Route path="/insights">
        <AuthenticatedLayout><Insights /></AuthenticatedLayout>
      </Route>
      <Route path="/logs">
        <AuthenticatedLayout><Logs /></AuthenticatedLayout>
      </Route>
      <Route path="/bot-commands">
        <AuthenticatedLayout><BotCommands /></AuthenticatedLayout>
      </Route>
      <Route path="/help">
        <AuthenticatedLayout><Help /></AuthenticatedLayout>
      </Route>
      <Route path="/game-profile">
        <AuthenticatedLayout><GameProfile /></AuthenticatedLayout>
      </Route>
      <Route path="/branding">
        <AuthenticatedLayout><Branding /></AuthenticatedLayout>
      </Route>
      <Route path="/marketplace/listing/:id">
        <MarketplaceListing />
      </Route>
      <Route path="/marketplace/create">
        <MarketplaceCreate />
      </Route>
      <Route path="/marketplace/seller/:id">
        <MarketplaceSeller />
      </Route>
      <Route path="/marketplace">
        <MarketplacePublic />
      </Route>
      <Route path="/marketplace-dashboard">
        <AuthenticatedLayout><Marketplace /></AuthenticatedLayout>
      </Route>
      <Route path="/changelog">
        <AuthenticatedLayout><Changelog /></AuthenticatedLayout>
      </Route>
      <Route path="/v/:vanityUrl">
        <PublicGameProfile />
      </Route>

      {/* Admin routes - hidden from public navigation */}
      <Route path="/admin-panel" component={AdminLogin} />
      <Route path="/admin-panel/dashboard" component={AdminDashboard} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
