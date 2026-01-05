import { Button } from "@/components/ui/button";
import { SiDiscord } from "react-icons/si";
import { Shield, Lock, AlertCircle } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { useEffect, useState } from "react";
import { DiscordLoginLoading } from "@/components/discord-login-loading";

const romoderateIcon = "/romoderate-icon.png";

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    const details = params.get('details');
    
    if (errorParam) {
      let errorMessage = 'An error occurred during login. Please try again.';
      
      switch (errorParam) {
        case 'session_expired':
        case 'state_expired':
          errorMessage = 'Your session expired. Please try logging in again.';
          break;
        case 'oauth_failed':
          errorMessage = details ? `Discord OAuth error: ${details}` : 'Discord authentication failed. Please try again.';
          break;
        case 'missing_code':
          errorMessage = 'Authorization code missing. Please try logging in again.';
          break;
        case 'missing_state':
        case 'invalid_state':
        case 'invalid_state_format':
          errorMessage = 'Invalid session. Please try logging in again.';
          break;
        case 'token_exchange_failed':
          errorMessage = 'Failed to exchange authorization code. Please check your Discord app configuration.';
          break;
        case 'no_access_token':
          errorMessage = 'No access token received from Discord. Please try again.';
          break;
      }
      
      setError(errorMessage);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleDiscordLogin = () => {
    setError(null);
    setIsLoading(true);
    console.log('[Login] Redirecting to Discord OAuth...');
    window.location.href = "/api/auth/discord";
  };

  if (isLoading) {
    return <DiscordLoginLoading />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden min-h-screen">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        
        <div className="relative">
          <PublicNav />

          <div className="container mx-auto px-6 flex items-center justify-center" style={{ minHeight: 'calc(100vh - 100px)' }}>
            <div className="max-w-md w-full">
              <div className="text-center mb-12">
                <div className="flex items-center justify-center mb-8">
                  <img 
                    src={romoderateIcon} 
                    alt="RoModerate" 
                    className="h-20 w-20 object-contain"
                  />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">Sign In</h1>
                <p className="text-lg text-muted-foreground">
                  Continue with Discord to access RoMarketplace
                </p>
              </div>

              <div className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
                
                <Button 
                  size="lg"
                  className="w-full gap-3 text-lg h-14"
                  onClick={handleDiscordLogin}
                  data-testid="button-discord-login"
                >
                  <SiDiscord className="h-6 w-6" />
                  Continue with Discord
                </Button>

                <div className="grid grid-cols-2 gap-4 pt-6">
                  <div className="text-center p-4 rounded-lg border border-border/50">
                    <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium mb-1">Secure</p>
                    <p className="text-xs text-muted-foreground">
                      OAuth 2.0
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-lg border border-border/50">
                    <Lock className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium mb-1">Private</p>
                    <p className="text-xs text-muted-foreground">
                      Your data is safe
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-8">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
