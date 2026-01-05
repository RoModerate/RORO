import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";

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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <style>{`
        .coming-soon-blur {
          filter: blur(8px);
          pointer-events: none;
          user-select: none;
        }
        .scrollbar-gray::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-gray::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-gray::-webkit-scrollbar-thumb {
          background: #808080;
          border-radius: 4px;
        }
        .scrollbar-gray::-webkit-scrollbar-thumb:hover {
          background: #a0a0a0;
        }
        .scrollbar-gray {
          scrollbar-color: #808080 transparent;
        }
      `}</style>
      
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">RoMarketplace</h1>
            <p className="text-2xl font-semibold text-primary">Coming Soon</p>
            <p className="text-muted-foreground text-lg">
              The premier Roblox marketplace experience is launching very soon
            </p>
          </div>

          {countdown && (
            <div className="grid grid-cols-4 gap-4 pt-4">
              <div className="bg-card rounded-lg p-6 border">
                <div className="text-3xl font-bold text-primary">{countdown.days}</div>
                <div className="text-sm text-muted-foreground">Days</div>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <div className="text-3xl font-bold text-primary">{countdown.hours.toString().padStart(2, '0')}</div>
                <div className="text-sm text-muted-foreground">Hours</div>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <div className="text-3xl font-bold text-primary">{countdown.minutes.toString().padStart(2, '0')}</div>
                <div className="text-sm text-muted-foreground">Minutes</div>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <div className="text-3xl font-bold text-primary">{countdown.seconds.toString().padStart(2, '0')}</div>
                <div className="text-sm text-muted-foreground">Seconds</div>
              </div>
            </div>
          )}
        </div>

        <div className="coming-soon-blur space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-muted">Setup Area - Unlocking Soon</h2>
            <p className="text-muted-foreground">
              Explore the marketplace features once we launch
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
              <CardTitle className="flex items-center gap-2">
                Step 1: Select Your Server
              </CardTitle>
              <CardDescription>
                Choose which Discord server you want to configure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 scrollbar-gray" style={{maxHeight: '300px', overflowY: 'auto'}}>
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

        <Button 
          onClick={() => setLocation("/")} 
          className="w-full"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}
