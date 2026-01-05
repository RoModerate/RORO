import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  ShoppingBag,
  Users,
  AlertTriangle,
  BarChart3,
  LogOut,
  Package,
  CheckCircle2,
  Store,
  ChevronRight,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: admin, isLoading, error } = useQuery<{ id: string; username: string; role: string }>({
    queryKey: ["/api/admin/me"],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    enabled: !!admin,
  });

  useEffect(() => {
    if (!isLoading && (error || !admin)) {
      setLocation("/admin-panel");
    }
  }, [isLoading, error, admin, setLocation]);

  const handleLogout = async () => {
    try {
      await apiRequest("/api/admin/logout", "POST");
      toast({ title: "Logged Out", description: "You have been logged out successfully" });
      setLocation("/admin-panel");
    } catch (error) {
      toast({ title: "Error", description: "Failed to logout", variant: "destructive" });
    }
  };

  if (isLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const statsCards = [
    { 
      label: "Pending Listings", 
      value: stats?.pendingListings?.toString() || "0", 
      icon: Package, 
      color: "bg-yellow-500/10 text-yellow-500" 
    },
    { 
      label: "Total Users", 
      value: stats?.totalUsers?.toString() || "0", 
      icon: Users, 
      color: "bg-blue-500/10 text-blue-500" 
    },
    { 
      label: "Completed Deals", 
      value: stats?.completedTransactions?.toString() || "0", 
      icon: CheckCircle2, 
      color: "bg-green-500/10 text-green-500" 
    },
    { 
      label: "Total Revenue", 
      value: `${stats?.totalRevenue?.toLocaleString() || "0"}`, 
      icon: BarChart3, 
      color: "bg-primary/10 text-primary" 
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">RoMarket Admin</h1>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{admin?.username}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" className="rounded-xl h-10 px-5 font-bold hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 space-y-12">
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Ecosystem Health
            </h2>
            <Badge variant="outline" className="rounded-lg border-primary/20 bg-primary/5 text-primary">Live Updates</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((stat, i) => (
              <Card key={i} className="rounded-3xl border-border/50 bg-card/30 hover:border-primary/50 transition-all duration-300">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                    <p className="text-4xl font-black" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="bg-border/50" />

        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="rounded-[2rem] border-border/50 bg-card/30 shadow-sm overflow-hidden group">
            <CardHeader className="bg-muted/20 pb-6 border-b border-border/50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  Marketplace
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </CardTitle>
              <CardDescription className="font-medium">Audit and approve listings</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="text-5xl font-black">{stats?.pendingListings || 0}</div>
                <Badge className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 rounded-lg">Action Required</Badge>
              </div>
              <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => setLocation("/admin/marketplace")}>
                Launch Control Center
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-border/50 bg-card/30 shadow-sm overflow-hidden group">
            <CardHeader className="bg-muted/20 pb-6 border-b border-border/50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  User Records
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </CardTitle>
              <CardDescription className="font-medium">Manage global accounts</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="text-5xl font-black">{stats?.totalUsers || 0}</div>
                <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 rounded-lg">Active Database</Badge>
              </div>
              <Button variant="outline" className="w-full h-12 rounded-2xl font-bold border-border/50" onClick={() => setLocation("/admin/users")}>
                View User Directory
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-border/50 bg-card/30 shadow-sm overflow-hidden group">
            <CardHeader className="bg-muted/20 pb-6 border-b border-border/50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Active Disputes
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </CardTitle>
              <CardDescription className="font-medium">Resolve transaction issues</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="text-5xl font-black text-destructive/50">0</div>
                <Badge variant="secondary" className="rounded-lg">Clean Record</Badge>
              </div>
              <Button variant="ghost" className="w-full h-12 rounded-2xl font-bold hover:bg-destructive/5" disabled>
                Open Resolution Desk
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
