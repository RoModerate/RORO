import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import { Store, LayoutDashboard, CreditCard, FileText, ChevronRight } from "lucide-react";
import type { User } from "@shared/schema";

const romoderateIcon = "/romoderate-icon.png";

export function PublicNav() {
  const [location, setLocation] = useLocation();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const isActive = (path: string) => location === path;

  return (
    <header className="sticky top-0 z-50 w-full bg-background/60 backdrop-blur-2xl border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-10">
            <Link 
              href="/"
              className="flex items-center gap-3 group transition-all"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all" />
                <img 
                  src={romoderateIcon} 
                  alt="RoModerate" 
                  className="h-9 w-9 object-contain relative transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <span className="text-2xl font-black tracking-tighter bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                RoModerate
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {[
                { label: "Marketplace", href: "/marketplace", icon: Store },
                { label: "Pricing", href: "/pricing", icon: CreditCard },
                { label: "Docs", href: "/docs", icon: FileText },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`h-10 px-4 rounded-xl text-sm font-medium transition-all group ${
                      isActive(item.href) 
                        ? "bg-primary/10 text-primary hover:bg-primary/15" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 mr-2 transition-colors ${isActive(item.href) ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <Link href="/dashboard">
                  <Button 
                    variant="secondary"
                    className="h-10 px-5 rounded-xl bg-card border border-border/50 hover-elevate active-elevate-2 font-bold group"
                  >
                    <LayoutDashboard className="h-4 w-4 mr-2 text-primary" />
                    Dashboard
                    <ChevronRight className="h-3.5 w-3.5 ml-1 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
                <div className="w-px h-6 bg-border/50 mx-1" />
                <UserAvatarMenu user={user} />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login">
                  <Button variant="ghost" className="h-10 px-6 rounded-xl font-bold">
                    Log In
                  </Button>
                </Link>
                <Link href="/login">
                  <Button className="h-10 px-6 rounded-xl shadow-lg shadow-primary/20 font-black tracking-tight">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
