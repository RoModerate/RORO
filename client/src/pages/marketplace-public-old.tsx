import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  ShoppingCart, 
  TrendingUp, 
  Sparkles, 
  Grid3X3,
  Store,
  SlidersHorizontal,
  ChevronDown,
  LogIn,
  Plus,
  Heart,
  MessageCircle,
  User,
  Settings,
  LogOut,
  Package,
  ShieldCheck,
  Flag,
  Trash2,
  MoreVertical
} from "lucide-react";
import type { MarketplaceListing, User as UserType } from "../../../shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function MarketplacePublic() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("trending");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'listing' | 'seller'; id: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState("");

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: listings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/listings"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (listingId: string) => {
      return apiRequest("DELETE", `/api/marketplace/listings/${listingId}`);
    },
    onSuccess: () => {
      toast({ title: "Listing deleted", description: "Your listing has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete listing.", variant: "destructive" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: { type: string; targetId: string; reason: string }) => {
      return apiRequest("POST", "/api/marketplace/reports", data);
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thank you for helping keep our marketplace safe." });
      setReportDialogOpen(false);
      setReportReason("");
      setReportTarget(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit report.", variant: "destructive" });
    },
  });

  const handleReport = (type: 'listing' | 'seller', id: string, name: string) => {
    if (!user) {
      toast({ title: "Login required", description: "Please sign in to report content.", variant: "destructive" });
      return;
    }
    setReportTarget({ type, id, name });
    setReportDialogOpen(true);
  };

  const submitReport = () => {
    if (!reportTarget || !reportReason.trim()) return;
    reportMutation.mutate({
      type: reportTarget.type,
      targetId: reportTarget.id,
      reason: reportReason,
    });
  };

  const categories = [
    { value: "all", label: "All Items", count: listings.length },
    { value: "ugc", label: "UGC Items", count: listings.filter(l => l.category === "ugc").length },
    { value: "game-passes", label: "Game Passes", count: listings.filter(l => l.category === "game-passes").length },
    { value: "plugins", label: "Plugins & Tools", count: listings.filter(l => l.category === "plugins").length },
    { value: "models", label: "3D Models", count: listings.filter(l => l.category === "models").length },
    { value: "audio", label: "Audio", count: listings.filter(l => l.category === "audio").length },
  ];

  const filteredListings = listings
    .filter((listing) => {
      const matchesSearch =
        searchQuery === "" ||
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || listing.category === selectedCategory;
      return matchesSearch && matchesCategory && listing.status === "active";
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.price - b.price;
        case "price-high":
          return b.price - a.price;
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "trending":
        default:
          return b.viewCount - a.viewCount;
      }
    });

  const userAvatar = user?.avatar 
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Professional Header like Facebook Marketplace */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setLocation("/marketplace")}
                className="flex items-center gap-2 font-bold text-xl hover-elevate px-3 py-2 rounded-md"
                data-testid="button-home"
              >
                <Store className="h-6 w-6 text-primary" />
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  RoMarket
                </span>
              </button>
              
              {/* Category Navigation */}
              <nav className="hidden lg:flex items-center gap-1">
                {categories.slice(0, 5).map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all hover-elevate ${
                      selectedCategory === cat.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`button-category-${cat.value}`}
                  >
                    {cat.label}
                    {cat.count > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {cat.count}
                      </Badge>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {/* Sell Button */}
                  <Button
                    onClick={() => setLocation("/marketplace/create")}
                    size="sm"
                    className="gap-2"
                    data-testid="button-create-listing"
                  >
                    <Plus className="h-4 w-4" />
                    Sell Item
                  </Button>

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0" data-testid="button-user-menu">
                        <Avatar className="h-10 w-10 border-2 border-primary/20">
                          <AvatarImage src={userAvatar} alt={user.username} />
                          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                            {user.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user.username}</p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.email || "Discord User"}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setLocation(`/marketplace/seller/${user.id}`)} data-testid="menu-my-profile">
                        <User className="mr-2 h-4 w-4" />
                        My Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/marketplace/my-listings")} data-testid="menu-my-listings">
                        <Package className="mr-2 h-4 w-4" />
                        My Listings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/marketplace/favorites")} data-testid="menu-favorites">
                        <Heart className="mr-2 h-4 w-4" />
                        Favorites
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/marketplace/messages")} data-testid="menu-messages">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Messages
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => window.location.href = '/api/auth/logout'}
                        className="text-destructive focus:text-destructive"
                        data-testid="menu-logout"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button
                  onClick={() => window.location.href = "/api/auth/discord?returnTo=/marketplace"}
                  size="sm"
                  className="gap-2"
                  data-testid="button-login"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In with Discord
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Search Section */}
      <section className="border-b bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                Discover Amazing Roblox Items
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              The largest marketplace for Roblox creators. Buy, sell, and trade with confidence.
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search for items, creators, or game passes..."
                className="pl-12 pr-4 h-14 text-lg bg-background/80 backdrop-blur-sm border-2 focus:border-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>

            {/* Quick Stats */}
            <div className="flex items-center justify-center gap-8 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{listings.length}</div>
                <div className="text-sm text-muted-foreground">Active Listings</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">1.2K+</div>
                <div className="text-sm text-muted-foreground">Verified Sellers</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <div className="flex items-center gap-1 text-2xl font-bold text-green-500">
                  <ShieldCheck className="h-5 w-5" />
                  Safe
                </div>
                <div className="text-sm text-muted-foreground">Escrow Protected</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters & Sort Bar */}
      <section className="border-b bg-card/50 sticky top-16 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
              {/* Mobile Category Pills */}
              <div className="flex lg:hidden items-center gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat.value}
                    variant={selectedCategory === cat.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.value)}
                    className="whitespace-nowrap"
                    data-testid={`button-mobile-category-${cat.value}`}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
              
              <Button variant="outline" size="sm" className="gap-2 hidden md:flex" data-testid="button-filters">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 hidden md:flex" data-testid="button-price-range">
                    Price Range
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setPriceRange("all")}>All Prices</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPriceRange("0-100")}>Under 100 Robux</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPriceRange("100-500")}>100 - 500 Robux</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPriceRange("500-1000")}>500 - 1000 Robux</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPriceRange("1000+")}>1000+ Robux</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {filteredListings.length} items
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary"
                data-testid="select-sort"
              >
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Listings Grid */}
      <section className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-square bg-muted animate-pulse" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-6 bg-muted rounded animate-pulse w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No items found</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? "Try adjusting your search" : "Be the first to list an item!"}
            </p>
            {user && (
              <Button onClick={() => setLocation("/marketplace/create")} data-testid="button-create-first">
                <Sparkles className="h-4 w-4 mr-2" />
                Create Listing
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((listing) => {
              const isOwner = user && listing.sellerId === user.id;
              const sellerInfo = (listing as any).seller;
              
              return (
                <Card
                  key={listing.id}
                  className="group overflow-hidden hover-elevate cursor-pointer transition-all border-2 hover:border-primary/50 relative"
                  data-testid={`card-listing-${listing.id}`}
                >
                  {/* Actions Menu */}
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-8 w-8 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-listing-menu-${listing.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isOwner ? (
                          <>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/marketplace/edit/${listing.id}`);
                              }}
                              data-testid={`menu-edit-${listing.id}`}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Edit Listing
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Are you sure you want to delete this listing?")) {
                                  deleteMutation.mutate(listing.id);
                                }
                              }}
                              className="text-destructive focus:text-destructive"
                              data-testid={`menu-delete-${listing.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Listing
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReport('listing', listing.id, listing.title);
                              }}
                              data-testid={`menu-report-${listing.id}`}
                            >
                              <Flag className="mr-2 h-4 w-4" />
                              Report Listing
                            </DropdownMenuItem>
                            {sellerInfo && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReport('seller', listing.sellerId, sellerInfo.username || 'Seller');
                                }}
                                data-testid={`menu-report-seller-${listing.id}`}
                              >
                                <Flag className="mr-2 h-4 w-4" />
                                Report Seller
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Clickable area */}
                  <div onClick={() => setLocation(`/marketplace/listing/${listing.id}`)}>
                    {/* Image */}
                    <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10">
                      {listing.images && listing.images.length > 0 ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Grid3X3 className="h-20 w-20 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      {/* Trending Badge */}
                      {listing.viewCount > 100 && (
                        <Badge className="absolute top-3 left-3 gap-1 bg-primary/90 backdrop-blur-sm">
                          <TrendingUp className="h-3 w-3" />
                          Trending
                        </Badge>
                      )}
                      
                      {/* Owner Badge */}
                      {isOwner && (
                        <Badge variant="secondary" className="absolute bottom-3 left-3 backdrop-blur-sm">
                          Your Listing
                        </Badge>
                      )}
                    </div>

                    {/* Content */}
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                          {listing.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {listing.description}
                        </p>
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">
                          {listing.price.toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {listing.currency}
                        </Badge>
                      </div>

                      {/* Tags */}
                      {listing.tags && listing.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {listing.tags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Seller Info - Clickable */}
                      <div 
                        className="flex items-center gap-2 pt-2 border-t cursor-pointer hover:bg-muted/50 -mx-4 px-4 py-2 -mb-4 rounded-b-lg transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/marketplace/seller/${listing.sellerId}`);
                        }}
                        data-testid={`link-seller-${listing.id}`}
                      >
                        <Avatar className="h-7 w-7 border">
                          {sellerInfo?.avatar ? (
                            <AvatarImage 
                              src={`https://cdn.discordapp.com/avatars/${sellerInfo.discordId}/${sellerInfo.avatar}.png`} 
                            />
                          ) : null}
                          <AvatarFallback className="text-xs bg-primary/10">
                            {sellerInfo?.username?.[0]?.toUpperCase() || 'S'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {sellerInfo?.username || 'Unknown Seller'}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {reportTarget?.type === 'listing' ? 'Listing' : 'Seller'}</DialogTitle>
            <DialogDescription>
              Reporting: {reportTarget?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Please describe why you're reporting this content..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
              data-testid="input-report-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)} data-testid="button-cancel-report">
              Cancel
            </Button>
            <Button 
              onClick={submitReport} 
              disabled={!reportReason.trim() || reportMutation.isPending}
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-6 w-6 text-primary" />
                <span className="font-bold text-lg">RoMarket</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The most trusted marketplace for Roblox creators and gamers worldwide.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Marketplace</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/marketplace" className="hover:text-foreground transition-colors">Browse Items</a></li>
                <li><a href="/marketplace/create" className="hover:text-foreground transition-colors">Sell Items</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Top Sellers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Safety & Security</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2025 RoMarket. Secure escrow-protected transactions.
          </div>
        </div>
      </footer>
    </div>
  );
}
