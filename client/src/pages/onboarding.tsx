import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Server, Bot, Hash, Key, CheckCircle2, Copy, ExternalLink, CheckSquare, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Server as ServerType } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ChannelSelector } from "@/components/channel-selector";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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
  
  // Load saved progress from localStorage
  const getSavedState = (key: string, defaultValue: any) => {
    try {
      const saved = localStorage.getItem(`onboarding_${key}`);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  };
  
  const [step, setStep] = useState(() => getSavedState('step', 1));
  const [selectedServerId, setSelectedServerId] = useState<string>(() => getSavedState('selectedServerId', ''));
  const [selectedServer, setSelectedServer] = useState<ServerType | null>(null);
  const [botInstalled, setBotInstalled] = useState(false);
  
  // Channel Setup Fields
  const [reportsChannel, setReportsChannel] = useState(() => getSavedState('reportsChannel', ''));
  const [reportLogsChannel, setReportLogsChannel] = useState(() => getSavedState('reportLogsChannel', ''));
  const [appealsCategory, setAppealsCategory] = useState(() => getSavedState('appealsCategory', ''));
  const [appealLogsChannel, setAppealLogsChannel] = useState(() => getSavedState('appealLogsChannel', ''));
  const [ticketsChannel, setTicketsChannel] = useState(() => getSavedState('ticketsChannel', ''));
  
  // Bot Token Fields (Step 4)
  const [customBotToken, setCustomBotToken] = useState("");
  const [customBotClientId, setCustomBotClientId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "VIEW_CHANNEL",
    "SEND_MESSAGES",
    "EMBED_LINKS",
    "MANAGE_MESSAGES",
    "READ_MESSAGE_HISTORY",
  ]);
  
  // Generated Keys
  const [botKey, setBotKey] = useState("");
  const [linkKey, setLinkKey] = useState("");
  
  // Save progress to localStorage whenever key state changes (but not step 5 - setup complete)
  useEffect(() => {
    if (step < 5) {
      localStorage.setItem('onboarding_step', JSON.stringify(step));
    } else {
      // Clear all onboarding data when reaching step 5 (setup complete)
      localStorage.removeItem('onboarding_step');
      localStorage.removeItem('onboarding_selectedServerId');
      localStorage.removeItem('onboarding_reportsChannel');
      localStorage.removeItem('onboarding_reportLogsChannel');
      localStorage.removeItem('onboarding_appealsCategory');
      localStorage.removeItem('onboarding_appealLogsChannel');
      localStorage.removeItem('onboarding_ticketsChannel');
    }
  }, [step]);
  
  useEffect(() => {
    localStorage.setItem('onboarding_selectedServerId', JSON.stringify(selectedServerId));
  }, [selectedServerId]);
  
  useEffect(() => {
    localStorage.setItem('onboarding_reportsChannel', JSON.stringify(reportsChannel));
    localStorage.setItem('onboarding_reportLogsChannel', JSON.stringify(reportLogsChannel));
    localStorage.setItem('onboarding_appealsCategory', JSON.stringify(appealsCategory));
    localStorage.setItem('onboarding_appealLogsChannel', JSON.stringify(appealLogsChannel));
    localStorage.setItem('onboarding_ticketsChannel', JSON.stringify(ticketsChannel));
  }, [reportsChannel, reportLogsChannel, appealsCategory, appealLogsChannel, ticketsChannel]);

  // Get bot client ID from environment
  const botClientId = import.meta.env.VITE_DISCORD_BOT_CLIENT_ID || "1431894445623607367";

  const { data: servers = [], isLoading: serversLoading } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const { data: botStatus } = useQuery<{ online: boolean; botTag?: string }>({
    queryKey: ["/api/bot/status"],
    refetchInterval: 5000,
  });
  
  // Validate saved server ID and clear if it no longer exists
  useEffect(() => {
    if (selectedServerId && servers.length > 0) {
      const serverExists = servers.some(s => s.id === selectedServerId);
      if (!serverExists) {
        // Clear invalid saved server ID
        console.log(`[Onboarding] Invalid server ID ${selectedServerId} detected, resetting to step 1`);
        setSelectedServerId('');
        setSelectedServer(null);
        // Reset to step 1 if we're past it
        if (step > 1) {
          setStep(1);
        }
      }
    }
  }, [servers, selectedServerId, step]);
  
  // Update selectedServer whenever selectedServerId changes
  useEffect(() => {
    if (selectedServerId && servers.length > 0) {
      const server = servers.find(s => s.id === selectedServerId);
      setSelectedServer(server || null);
    }
  }, [selectedServerId, servers]);

  const setupMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedServerId) {
        throw new Error("No server selected");
      }
      return apiRequest("PATCH", `/api/servers/${selectedServerId}/complete-setup`, data);
    },
    onSuccess: (response: any) => {
      if (response.botKey) {
        setBotKey(response.botKey);
      }
      if (response.linkKey) {
        setLinkKey(response.linkKey);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      // Move to step 5 - localStorage will be cleared by useEffect
      setStep(5);
    },
    onError: (error: any) => {
      console.error("Setup mutation error:", error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    },
  });

  const botTokenMutation = useMutation({
    mutationFn: async (data: { botToken?: string; botClientId?: string; skipToken?: boolean }) => {
      return apiRequest("PATCH", `/api/servers/${selectedServerId}/bot-token`, data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      toast({
        title: "Bot Started Successfully",
        description: response.botOnline ? `${response.botName} is now online` : "Bot token saved",
      });
      // Don't change step - handleBotTokenSubmit will call setupMutation next
    },
    onError: (error: any) => {
      toast({
        title: "Bot Configuration Failed",
        description: error.message || "Failed to save bot configuration",
        variant: "destructive",
      });
    },
  });

  const handleServerSelect = () => {
    if (!selectedServerId) {
      toast({
        title: "Select a Server",
        description: "Please select a Discord server to continue",
        variant: "destructive",
      });
      return;
    }
    // selectedServer is already set by useEffect, just move to next step
    setStep(2);
  };

  const handleBotInstallConfirm = () => {
    setBotInstalled(true);
    setStep(3);
  };

  const handleChannelSetup = () => {
    if (!reportsChannel || !ticketsChannel) {
      toast({
        title: "Missing Channels",
        description: "Please provide at least the reports and tickets channels",
        variant: "destructive",
      });
      return;
    }
    
    setStep(4);
  };

  const handleBotTokenSubmit = async () => {
    if (!selectedServerId) {
      toast({
        title: "Error",
        description: "No server selected. Please go back and select a server.",
        variant: "destructive",
      });
      return;
    }
    
    if (customBotToken && !customBotClientId) {
      toast({
        title: "Bot Client ID Required",
        description: "Please provide your bot's client ID along with the token",
        variant: "destructive",
      });
      return;
    }
    
    if (!reportsChannel || !ticketsChannel) {
      toast({
        title: "Missing Required Channels",
        description: "Reports channel and tickets channel are required",
        variant: "destructive",
      });
      setStep(3);
      return;
    }
    
    // If custom bot token provided, save it first
    if (customBotToken) {
      try {
        await botTokenMutation.mutateAsync({
          botToken: customBotToken,
          botClientId: customBotClientId,
        });
      } catch (error) {
        // Error already handled by mutation onError
        return;
      }
    }
    
    // Then complete setup
    setupMutation.mutate({
      reportsChannel,
      reportLogsChannel: reportLogsChannel || undefined,
      appealsCategory: appealsCategory || undefined,
      appealLogsChannel: appealLogsChannel || undefined,
      ticketsChannel,
    });
  };

  const handleSkipBotToken = () => {
    if (!selectedServerId) {
      toast({
        title: "Error",
        description: "No server selected. Please go back and select a server.",
        variant: "destructive",
      });
      return;
    }
    
    if (!reportsChannel || !ticketsChannel) {
      toast({
        title: "Missing Required Channels",
        description: "Reports channel and tickets channel are required",
        variant: "destructive",
      });
      setStep(3);
      return;
    }
    
    setupMutation.mutate({
      reportsChannel,
      reportLogsChannel: reportLogsChannel || undefined,
      appealsCategory: appealsCategory || undefined,
      appealLogsChannel: appealLogsChannel || undefined,
      ticketsChannel,
    });
  };

  const copyBotKey = () => {
    navigator.clipboard.writeText(botKey);
    toast({
      title: "Copied!",
      description: "Bot key copied to clipboard",
    });
  };

  const copyLinkKey = () => {
    navigator.clipboard.writeText(linkKey);
    toast({
      title: "Copied!",
      description: "Link key copied to clipboard",
    });
  };

  const getServerIcon = (server: ServerType) => {
    if (server.icon) {
      return `https://cdn.discordapp.com/icons/${server.discordServerId}/${server.icon}.png?size=64`;
    }
    return null;
  };

  const getBotInviteUrl = () => {
    const permissions = "8";
    const scopes = "bot+applications.commands";
    return `https://discord.com/oauth2/authorize?client_id=${botClientId}&permissions=${permissions}&integration_type=0&scope=${scopes}${selectedServer ? `&guild_id=${selectedServer.discordServerId}` : ''}`;
  };

  const getCustomBotInviteUrl = () => {
    if (!customBotClientId) return "";
    const permissions = calculatePermissions();
    const scopes = "bot+applications.commands";
    return `https://discord.com/oauth2/authorize?client_id=${customBotClientId}&permissions=${permissions}&integration_type=0&scope=${scopes}${selectedServer ? `&guild_id=${selectedServer.discordServerId}` : ''}`;
  };

  const calculatePermissions = () => {
    const permissionMap: Record<string, number> = {
      VIEW_CHANNEL: 1024,
      SEND_MESSAGES: 2048,
      EMBED_LINKS: 16384,
      ATTACH_FILES: 32768,
      READ_MESSAGE_HISTORY: 65536,
      MANAGE_MESSAGES: 8192,
      MANAGE_ROLES: 268435456,
      MANAGE_CHANNELS: 16,
      BAN_MEMBERS: 4,
      KICK_MEMBERS: 2,
    };
    
    return selectedPermissions.reduce((total, perm) => total + (permissionMap[perm] || 0), 0).toString();
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  if (serversLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Server className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Servers Found</h2>
        <p className="text-muted-foreground max-w-md mb-6 text-center">
          You need manage permissions on at least one Discord server to use RoModerate.
        </p>
        <Button onClick={() => window.location.href = "/api/auth/discord"}>
          Reconnect Discord
        </Button>
      </div>
    );
  }

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
                <Server className="h-5 w-5" />
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
          <p className="text-muted-foreground">
            Let's get your server set up and running!
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s < step ? "w-16 bg-primary" : s === step ? "w-16 bg-primary" : "w-8 bg-muted"
              }`}
              data-testid={`progress-step-${s}`}
            />
          ))}
        </div>

        {botStatus && (
          <Alert className="mb-6" data-testid="alert-bot-status">
            <Bot className="h-4 w-4" />
            <AlertDescription>
              RoModerate Bot: {botStatus.online ? (
                <Badge variant="default" className="ml-2">Online - {botStatus.botTag}</Badge>
              ) : (
                <Badge variant="destructive" className="ml-2">Offline</Badge>
              )}
            </AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <Card data-testid="card-server-selection">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Step 1: Select Your Server
              </CardTitle>
              <CardDescription>
                Choose which Discord server you want to configure with RoModerate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="server-select">Discord Server</Label>
                <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                  <SelectTrigger id="server-select" data-testid="select-server">
                    <SelectValue placeholder="Select a server">
                      {selectedServer && (
                        <div className="flex items-center gap-2">
                          {getServerIcon(selectedServer) ? (
                            <img 
                              src={getServerIcon(selectedServer)!} 
                              alt={selectedServer.name}
                              className="h-5 w-5 rounded"
                            />
                          ) : (
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {selectedServer.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span>{selectedServer.name}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map((server) => (
                      <SelectItem key={server.id} value={server.id} data-testid={`server-option-${server.id}`}>
                        <div className="flex items-center gap-2">
                          {getServerIcon(server) ? (
                            <img 
                              src={getServerIcon(server)!} 
                              alt={server.name}
                              className="h-5 w-5 rounded"
                            />
                          ) : (
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {server.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span>{server.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleServerSelect} 
                className="w-full"
                data-testid="button-continue-server"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card data-testid="card-bot-install">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Step 2: Install RoModerate Bot
              </CardTitle>
              <CardDescription>
                Add the official RoModerate bot to your Discord server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Important:</strong> The RoModerate bot must be installed in your server before you can configure channels and roles.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold text-primary">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Click the button below to authorize the bot</p>
                    <p className="text-sm text-muted-foreground">
                      This will open Discord's authorization page for your selected server
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold text-primary">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">Ensure required permissions are enabled</p>
                    <div className="space-y-2 ml-2">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        <span className="text-sm">Read Messages/View Channels</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        <span className="text-sm">Send Messages</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        <span className="text-sm">Manage Messages</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        <span className="text-sm">Embed Links</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        <span className="text-sm">Manage Roles</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold text-primary">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Authorize the bot</p>
                    <p className="text-sm text-muted-foreground">
                      Click "Authorize" in Discord, then return here to continue setup
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={() => window.open(getBotInviteUrl(), '_blank')} 
                  className="w-full"
                  data-testid="button-install-bot"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Install RoModerate Bot
                </Button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStep(1)}
                  data-testid="button-back-to-server"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleBotInstallConfirm} 
                  className="flex-1"
                  data-testid="button-continue-channels"
                >
                  I've Installed the Bot - Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card data-testid="card-channel-setup">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Step 3: Channel Configuration
              </CardTitle>
              <CardDescription>
                Select the Discord channels for reports, appeals, and tickets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reports-channel">Reports Channel *</Label>
                <ChannelSelector
                  serverId={selectedServerId}
                  value={reportsChannel}
                  onChange={setReportsChannel}
                  type="text"
                  placeholder="Select reports channel"
                  testId="select-reports-channel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-logs-channel">Report Logs Channel</Label>
                <ChannelSelector
                  serverId={selectedServerId}
                  value={reportLogsChannel}
                  onChange={setReportLogsChannel}
                  type="text"
                  placeholder="Select report logs channel"
                  testId="select-report-logs-channel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appeals-category">Appeals Category</Label>
                <ChannelSelector
                  serverId={selectedServerId}
                  value={appealsCategory}
                  onChange={setAppealsCategory}
                  type="category"
                  placeholder="Select appeals category"
                  testId="select-appeals-category"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appeal-logs-channel">Appeal Logs Channel</Label>
                <ChannelSelector
                  serverId={selectedServerId}
                  value={appealLogsChannel}
                  onChange={setAppealLogsChannel}
                  type="text"
                  placeholder="Select appeal logs channel"
                  testId="select-appeal-logs-channel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tickets-channel">Tickets Channel *</Label>
                <ChannelSelector
                  serverId={selectedServerId}
                  value={ticketsChannel}
                  onChange={setTicketsChannel}
                  type="text"
                  placeholder="Select tickets channel"
                  testId="select-tickets-channel"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStep(2)}
                  data-testid="button-back-to-bot"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleChannelSetup} 
                  className="flex-1"
                  data-testid="button-continue-to-bot-token"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card data-testid="card-bot-token-setup">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Step 4: Custom Bot Configuration (Optional)
              </CardTitle>
              <CardDescription>
                Add your own Discord bot or skip to use only the RoModerate bot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertDescription>
                  <strong>Optional:</strong> You can use your own Discord bot for additional features and customization. If you skip this step, only the RoModerate bot will be used.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bot-client-id">Bot Client ID</Label>
                  <Input
                    id="bot-client-id"
                    placeholder="Enter your bot's client ID"
                    value={customBotClientId}
                    onChange={(e) => setCustomBotClientId(e.target.value)}
                    data-testid="input-bot-client-id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bot-token">Bot Token</Label>
                  <Input
                    id="bot-token"
                    type="password"
                    placeholder="Enter your bot token (securely encrypted)"
                    value={customBotToken}
                    onChange={(e) => setCustomBotToken(e.target.value)}
                    data-testid="input-bot-token"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your bot token is encrypted before being stored
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Bot Permissions</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "VIEW_CHANNEL", label: "View Channels" },
                      { id: "SEND_MESSAGES", label: "Send Messages" },
                      { id: "EMBED_LINKS", label: "Embed Links" },
                      { id: "ATTACH_FILES", label: "Attach Files" },
                      { id: "READ_MESSAGE_HISTORY", label: "Read Message History" },
                      { id: "MANAGE_MESSAGES", label: "Manage Messages" },
                      { id: "MANAGE_ROLES", label: "Manage Roles" },
                      { id: "MANAGE_CHANNELS", label: "Manage Channels" },
                      { id: "BAN_MEMBERS", label: "Ban Members" },
                      { id: "KICK_MEMBERS", label: "Kick Members" },
                    ].map((perm) => (
                      <div key={perm.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={perm.id}
                          checked={selectedPermissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={perm.id} className="text-sm cursor-pointer">
                          {perm.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {customBotClientId && (
                  <div className="space-y-2">
                    <Label>OAuth2 Invite URL</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={getCustomBotInviteUrl()}
                        className="font-mono text-xs"
                        data-testid="input-oauth-url"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(getCustomBotInviteUrl());
                          toast({ title: "Copied!", description: "OAuth2 URL copied to clipboard" });
                        }}
                        data-testid="button-copy-oauth-url"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button 
                      onClick={() => window.open(getCustomBotInviteUrl(), '_blank')} 
                      variant="outline"
                      className="w-full mt-2"
                      data-testid="button-invite-custom-bot"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Invite Your Bot to Server
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStep(3)}
                  data-testid="button-back-to-channels"
                >
                  Back
                </Button>
                <Button 
                  variant="ghost"
                  onClick={handleSkipBotToken} 
                  disabled={setupMutation.isPending}
                  data-testid="button-skip-bot-token"
                  className="flex-1"
                >
                  {setupMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Skip & Complete Setup"
                  )}
                </Button>
                <Button 
                  onClick={handleBotTokenSubmit} 
                  className="flex-1"
                  disabled={setupMutation.isPending || (!customBotToken && !customBotClientId)}
                  data-testid="button-save-bot-token"
                >
                  {setupMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Bot & Complete Setup"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card data-testid="card-setup-complete">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Setup Complete!
              </CardTitle>
              <CardDescription>
                Your server is configured. Save this Bot Key for Discord bot integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>IMPORTANT:</strong> Save your Link Key and use it in Discord to complete setup.
                </AlertDescription>
              </Alert>

              {linkKey && (
                <div className="space-y-2">
                  <Label>Link Key (for /linkkey command)</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={linkKey}
                      className="font-mono text-lg font-bold"
                      data-testid="input-link-key"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={copyLinkKey}
                      data-testid="button-copy-link-key"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this key with the /linkkey command in your Discord server to complete the bot linking.
                  </p>
                </div>
              )}

              {botKey && (
                <div className="space-y-2">
                  <Label>Bot Key (for API integration)</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={botKey}
                      className="font-mono"
                      data-testid="input-bot-key"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={copyBotKey}
                      data-testid="button-copy-bot-key"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Store this securely for API integrations and advanced features.
                  </p>
                </div>
              )}

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Next Steps:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Copy the Link Key above</li>
                  <li>In your Discord server, run /linkkey and paste the key</li>
                  <li>Configure team member roles and permissions</li>
                  <li>Set up ticket categories and ban appeal webhooks</li>
                </ul>
              </div>

              <Button 
                onClick={() => setLocation("/dashboard")} 
                className="w-full"
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
