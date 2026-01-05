import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Sparkles } from "lucide-react";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState<{days: number; hours: number; minutes: number; seconds: number} | null>(null);
  
  // Calculate countdown to 3 months from now
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const launchDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 3 months from now
      
      const diff = launchDate.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      setCountdown({ days, hours, minutes, seconds });
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show Coming Soon page
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
      <style>{`
        .coming-soon-blur {
          filter: blur(12px) brightness(0.8);
          pointer-events: none;
          user-select: none;
          opacity: 0.6;
        }
        .countdown-item {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
          border: 1px solid rgba(59, 130, 246, 0.3);
          transition: all 0.3s ease;
        }
        .countdown-item:hover {
          border-color: rgba(59, 130, 246, 0.6);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%);
        }
        .scrollbar-dark::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-dark::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        .scrollbar-dark::-webkit-scrollbar-thumb {
          background: #3f3f3f;
          border-radius: 4px;
        }
        .scrollbar-dark::-webkit-scrollbar-thumb:hover {
          background: #4f4f4f;
        }
        .scrollbar-dark {
          scrollbar-color: #3f3f3f rgba(0, 0, 0, 0.05);
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.5); }
        }
        .glow-pulse {
          animation: pulse-glow 3s ease-in-out infinite;
        }
      `}</style>
      
      <div className="w-full max-w-2xl space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 glow-pulse">
            <Clock className="h-10 w-10 text-blue-500" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              <p className="text-sm font-semibold text-blue-500 tracking-wide uppercase">Coming Soon</p>
              <Sparkles className="h-5 w-5 text-blue-500" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              RoMarketplace
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              The premier Roblox marketplace experience is launching very soon
            </p>
          </div>
        </div>

        {/* Countdown Timer */}
        {countdown && (
          <div className="space-y-4">
            <p className="text-center text-sm font-medium text-muted-foreground">Launching in</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="countdown-item rounded-xl p-6 text-center backdrop-blur-sm">
                <div className="text-4xl md:text-5xl font-bold text-blue-600 font-mono">
                  {countdown.days}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground font-medium mt-2 uppercase tracking-wide">
                  Days
                </div>
              </div>
              <div className="countdown-item rounded-xl p-6 text-center backdrop-blur-sm">
                <div className="text-4xl md:text-5xl font-bold text-indigo-600 font-mono">
                  {countdown.hours.toString().padStart(2, '0')}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground font-medium mt-2 uppercase tracking-wide">
                  Hours
                </div>
              </div>
              <div className="countdown-item rounded-xl p-6 text-center backdrop-blur-sm">
                <div className="text-4xl md:text-5xl font-bold text-blue-600 font-mono">
                  {countdown.minutes.toString().padStart(2, '0')}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground font-medium mt-2 uppercase tracking-wide">
                  Minutes
                </div>
              </div>
              <div className="countdown-item rounded-xl p-6 text-center backdrop-blur-sm">
                <div className="text-4xl md:text-5xl font-bold text-indigo-600 font-mono">
                  {countdown.seconds.toString().padStart(2, '0')}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground font-medium mt-2 uppercase tracking-wide">
                  Seconds
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blurred Setup Area */}
        <div className="coming-soon-blur space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold">Setup Area</h2>
            <p className="text-muted-foreground">
              Unlocking soon
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all w-8 bg-muted`}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Your Server</CardTitle>
              <CardDescription>
                Choose which Discord server you want to configure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 scrollbar-dark max-h-[300px] overflow-y-auto">
              <div className="space-y-2">
                <Label>Discord Server</Label>
                <Select disabled>
                  <SelectTrigger disabled>
                    <SelectValue placeholder="Select a server" />
                  </SelectTrigger>
                </Select>
              </div>
              <Button disabled className="w-full">
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Action Button */}
        <Button 
          onClick={() => setLocation("/")} 
          variant="outline"
          className="w-full"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}
