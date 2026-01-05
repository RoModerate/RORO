import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Zap, BarChart3, Ban, FileCheck, Lock, Users, AlertCircle, Activity, Server, Search, CheckCircle2, TrendingUp, Sparkles, UserCog, ShoppingBag, Package, DollarSign, Star } from "lucide-react";
import { SiRoblox, SiDiscord } from "react-icons/si";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PublicNav } from "@/components/public-nav";
import type { User } from "@shared/schema";

const romoderateIcon = "/romoderate-icon.png";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  
  const features = [
    {
      icon: Search,
      title: "Roblox Player Lookup",
      description: "Search for players by username or ID with real-time data from Roblox's API."
    },
    {
      icon: Shield,
      title: "Advanced Moderation",
      description: "Ban management, appeal system, and comprehensive moderation tools."
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Assign moderators and administrators with custom role permissions."
    },
    {
      icon: Zap,
      title: "Auto Actions",
      description: "Automate bans based on report thresholds and moderator votes."
    },
    {
      icon: BarChart3,
      title: "Server Analytics",
      description: "Track bans, appeals, tickets, and moderation activity in real-time."
    },
    {
      icon: Lock,
      title: "Roblox API Integration",
      description: "Manage API keys and integrate with Roblox Open Cloud for ban enforcement."
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden min-h-screen">
        
        <div className="relative">
          <PublicNav />

          <div className="container mx-auto px-6 py-20 md:py-32">
            <div className="max-w-6xl mx-auto text-center space-y-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Badge variant="default" className="text-sm px-4 py-1.5 gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Now with Real-time Discord Integration
                </Badge>
              </div>
              
              <div className="flex items-center justify-center mb-8">
                <img 
                  src={romoderateIcon} 
                  alt="RoMarketplace" 
                  className="h-32 w-32 object-contain"
                />
              </div>
              
              <div className="space-y-6">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground">
                  Welcome to RoMarketplace
                </h1>
                <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                  Coming Soon - Secure Roblox Item Marketplace. The safest way to buy and sell UGC, plugins, and more.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 pt-6">
                {user ? (
                  <>
                    <Button 
                      size="lg" 
                      onClick={() => setLocation('/marketplace')}
                      data-testid="button-marketplace"
                    >
                      Explore Marketplace
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={() => setLocation('/dashboard')}
                      data-testid="button-dashboard"
                      className="gap-2"
                    >
                      <UserCog className="h-5 w-5" />
                      Dashboard
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      size="lg" 
                      onClick={() => window.location.href = "/api/auth/discord"}
                      data-testid="button-login"
                    >
                      Log In
                    </Button>
                  </>
                )}
              </div>

              {user && (
                <Card className="mt-12 border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UserCog className="h-5 w-5 text-primary" />
                      Moderator Quick Access
                    </CardTitle>
                    <CardDescription>
                      Manage reports and appeals directly from here
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setLocation('/moderation')}
                      className="h-20 flex-col gap-2"
                      data-testid="button-quick-moderation"
                    >
                      <Shield className="h-6 w-6" />
                      <span>Moderation Panel</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocation('/reports')}
                      className="h-20 flex-col gap-2"
                      data-testid="button-quick-reports"
                    >
                      <FileCheck className="h-6 w-6" />
                      <span>View Reports</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocation('/appeals')}
                      className="h-20 flex-col gap-2"
                      data-testid="button-quick-appeals"
                    >
                      <AlertCircle className="h-6 w-6" />
                      <span>Review Appeals</span>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>



          <section id="marketplace" className="container mx-auto px-6 py-20">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <Badge variant="outline" className="mb-4 px-4 py-1.5 gap-2 bg-secondary">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Secure Marketplace
                </Badge>
                <h2 className="text-4xl font-bold mb-4">Buy & Sell Roblox Items Safely</h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Trade Roblox assets with built-in escrow protection, seller verification, and anti-scam features to ensure safe transactions for everyone.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Escrow Protection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Funds are held securely until both parties confirm the transaction is complete, protecting buyers and sellers from scams.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Seller Verification</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Verified sellers undergo identity checks and build reputation scores, so you know who you're trading with.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Anti-Scam Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Automated fraud detection, proof of ownership requirements, and comprehensive transaction logs keep your trades secure.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-card border border-border rounded-lg p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl md:text-3xl font-bold mb-4">
                      Start Trading Today
                    </h3>
                    <p className="text-muted-foreground text-lg mb-6">
                      Join thousands of traders buying and selling Roblox assets with confidence. No hidden fees, transparent pricing, and 24/7 support.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                      <Button 
                        size="lg"
                        onClick={() => setLocation('/marketplace')}
                        className="gap-2"
                        data-testid="button-marketplace"
                      >
                        <ShoppingBag className="h-5 w-5" />
                        Browse Marketplace
                      </Button>
                      <Button 
                        size="lg" 
                        variant="outline"
                        onClick={() => setLocation('/docs')}
                        className="gap-2"
                        data-testid="button-marketplace-docs"
                      >
                        <FileCheck className="h-5 w-5" />
                        Seller Guidelines
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Star className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Trusted by Sellers</p>
                        <p className="text-sm text-muted-foreground">4.9/5 rating from 10,000+ trades</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <DollarSign className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Low Fees</p>
                        <p className="text-sm text-muted-foreground">Only 3% transaction fee</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="security" className="container mx-auto px-6 py-20">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <Badge variant="outline" className="mb-4 px-4 py-1.5 gap-2">
                  <Lock className="h-3.5 w-3.5" />
                  Security First
                </Badge>
                <h2 className="text-4xl font-bold mb-4">Built with Security as a Foundation</h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  RoModerate is built with security as a foundation, not an afterthought, providing developers with the robust protection they need to build with confidence.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <UserCog className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Granular Role-Based Access</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Fine-grained permission controls ensure team members only access what they need, preventing unauthorized actions and maintaining strict security boundaries.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>End-to-End Data Encryption</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      All sensitive data is encrypted in transit and at rest, protecting API keys, bot tokens, and player information from unauthorized access.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Proactive Threat Mitigation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Advanced monitoring and automated threat detection identify and block suspicious activity before it can impact your community.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Detailed Audit Trails</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Comprehensive logging of all moderation actions, API calls, and system changes provides full accountability and transparency.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Advanced Access Controls</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Multi-factor authentication, session management, and IP whitelisting options protect against unauthorized access to your dashboard.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <Server className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>DDoS & Rate Limiting Protection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Enterprise-grade infrastructure with built-in DDoS protection and intelligent rate limiting ensures your services stay online.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Continuous Security Updates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Regular security patches and proactive vulnerability assessments keep your platform protected against emerging threats.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover-elevate transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>OWASP Compliance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Built following industry-leading OWASP security standards, ensuring your games and player data are always secure.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-12 text-center">
                <p className="text-muted-foreground mb-6">
                  Learn more about RoModerate's commitment to security and how we protect your community.
                </p>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => setLocation('/docs')}
                  className="gap-2"
                  data-testid="button-security-docs"
                >
                  <Lock className="h-4 w-4" />
                  View Security Documentation
                </Button>
              </div>
            </div>
          </section>

          <section className="container mx-auto px-6 py-20 bg-muted/30">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-muted-foreground mb-12">
                Get started in minutes with our simple setup process
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
                    1
                  </div>
                  <h3 className="text-xl font-semibold">Connect Discord</h3>
                  <p className="text-muted-foreground">
                    Sign in securely with Discord OAuth
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
                    2
                  </div>
                  <h3 className="text-xl font-semibold">Configure Server</h3>
                  <p className="text-muted-foreground">
                    Set up your Discord bot and Roblox API keys
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
                    3
                  </div>
                  <h3 className="text-xl font-semibold">Start Moderating</h3>
                  <p className="text-muted-foreground">
                    Manage bans, appeals, and reports instantly
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="container mx-auto px-6 py-20">
            <div className="max-w-4xl mx-auto text-center">
              <Card className="p-12">
                <CardContent className="space-y-6">
                  <h2 className="text-4xl font-bold">Ready to Get Started?</h2>
                  <p className="text-xl text-muted-foreground">
                    Join thousands of developers using RoModerate to protect their communities
                  </p>
                  <Button 
                    size="lg"
                    onClick={() => setLocation('/login')}
                    data-testid="button-cta"
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <footer className="container mx-auto px-6 py-16 border-t">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <img 
                      src={romoderateIcon} 
                      alt="RoModerate" 
                      className="h-10 w-10 object-contain"
                    />
                    <div>
                      <p className="font-bold text-lg">RoModerate</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Professional Discord & Roblox moderation tools for your community. Streamline bans, appeals, and reports with ease.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4">Product</h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="block hover:text-foreground transition-colors">
                      Features
                    </button>
                    <button onClick={() => setLocation('/pricing')} className="block hover:text-foreground transition-colors">
                      Pricing
                    </button>
                    <button onClick={() => setLocation('/docs')} className="block hover:text-foreground transition-colors">
                      Documentation
                    </button>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4">Legal</h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <button onClick={() => setLocation('/legal')} className="block hover:text-foreground transition-colors" data-testid="link-legal">
                      Legal Information
                    </button>
                    <button onClick={() => setLocation('/terms')} className="block hover:text-foreground transition-colors">
                      Terms of Service
                    </button>
                    <button onClick={() => setLocation('/privacy')} className="block hover:text-foreground transition-colors">
                      Privacy Policy
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="pt-8 border-t text-center text-sm text-muted-foreground">
                <p>© 2024 RoModerate. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
