import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  ShoppingCart, 
  TrendingUp, 
  Sparkles, 
  Grid3X3,
  Store,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  User,
  LogIn,
  CheckCircle2,
  Package,
  ArrowRight
} from "lucide-react";
import type { MarketplaceListing, User as UserType } from "../../../shared/schema";
import { PublicNav } from "@/components/public-nav";

export default function MarketplacePublic() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("trending");

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: listings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/listings"],
  });

  const categories = [
    { value: "all", label: "All Items" },
    { value: "ugc", label: "UGC Items" },
    { value: "game-passes", label: "Game Passes" },
    { value: "plugins", label: "Plugins" },
    { value: "models", label: "Models" },
    { value: "audio", label: "Audio" },
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
        case "price-low": return a.price - b.price;
        case "price-high": return b.price - a.price;
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return b.viewCount - a.viewCount;
      }
    });

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <PublicNav />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10 -z-10" />
        <div className="container mx-auto px-4 text-center space-y-8 relative">
          <Badge variant="outline" className="px-4 py-1.5 border-primary/20 bg-primary/5 text-primary-foreground/80 rounded-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sparkles className="h-3.5 w-3.5 mr-2 text-primary" />
            The Premier Roblox Asset Marketplace
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-1000">
            Elevate Your <span className="text-primary italic">Creation</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Discover high-end, verified assets for your next big project. 
            Professional grade scripts, models, and assets at your fingertips.
          </p>

          <div className="max-w-2xl mx-auto relative group animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search assets, creators, or tags..."
              className="w-full h-16 pl-14 pr-6 rounded-2xl bg-card/50 backdrop-blur-md border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all text-lg shadow-2xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>

          <div className="flex items-center justify-center gap-12 pt-8 animate-in fade-in duration-1000">
            <div className="space-y-1">
              <div className="text-3xl font-bold">{listings.length}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Listings</div>
            </div>
            <div className="w-px h-12 bg-border/50" />
            <div className="space-y-1">
              <div className="text-3xl font-bold">100%</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Secure</div>
            </div>
            <div className="w-px h-12 bg-border/50" />
            <div className="space-y-1">
              <div className="text-3xl font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                Verified
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Sellers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:w-64 space-y-8 flex-shrink-0">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-2">Categories</h3>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <Button
                    key={cat.value}
                    variant={selectedCategory === cat.value ? "secondary" : "ghost"}
                    className="w-full justify-start rounded-xl px-3 h-10 hover-elevate group"
                    onClick={() => setSelectedCategory(cat.value)}
                  >
                    <Package className={`h-4 w-4 mr-3 transition-colors ${selectedCategory === cat.value ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-2">Sort By</h3>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full rounded-xl bg-card border-border/50 h-10">
                  <SelectValue placeholder="Sort items..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  <SelectItem value="trending">Trending</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {user && (
              <Button 
                className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 group overflow-hidden"
                onClick={() => setLocation("/marketplace/create")}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                List Your Asset
                <ArrowRight className="h-4 w-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Button>
            )}
          </aside>

          {/* Grid */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="rounded-2xl border-border/50 bg-card/50 overflow-hidden">
                    <div className="aspect-[4/3] bg-muted animate-pulse" />
                    <div className="p-5 space-y-4">
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                      <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                      <div className="flex justify-between items-center pt-4">
                        <div className="h-6 bg-muted rounded w-20 animate-pulse" />
                        <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-card/30 rounded-3xl border border-dashed border-border/50">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                  <Search className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No assets found</h3>
                <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredListings.map((listing) => (
                  <Card
                    key={listing.id}
                    className="group relative rounded-2xl border-border/50 bg-card/50 overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 cursor-pointer"
                    onClick={() => setLocation(`/marketplace/listing/${listing.id}`)}
                  >
                    <div className="aspect-[4/3] relative overflow-hidden bg-muted/30">
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground/20">
                          <Package className="h-16 w-16" />
                        </div>
                      )}
                      
                      <div className="absolute top-4 right-4 flex flex-col gap-2">
                        <Badge className="bg-background/80 backdrop-blur-md text-foreground border-border/50 hover:bg-background/90 rounded-lg">
                          {listing.category}
                        </Badge>
                        {listing.viewCount > 50 && (
                          <Badge className="bg-primary/90 text-white border-none rounded-lg shadow-lg">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Popular
                          </Badge>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                            {listing.title}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            <span>Verified Asset</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-primary">
                            {listing.price.toLocaleString()}
                          </div>
                          <div className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">
                            {listing.currency}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 border border-border/50">
                            {(listing as any).seller?.avatar ? (
                              <AvatarImage 
                                src={`https://cdn.discordapp.com/avatars/${(listing as any).seller.discordId}/${(listing as any).seller.avatar}.png`} 
                              />
                            ) : null}
                            <AvatarFallback className="text-[10px] font-bold">
                              {(listing as any).seller?.username?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">{(listing as any).seller?.username}</span>
                            <span className="text-[10px] text-muted-foreground">Pro Seller</span>
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" className="rounded-lg h-8 px-4 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modern Footer */}
      <footer className="border-t border-border/50 bg-card/30 mt-20">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
            <div className="space-y-4">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                  <Store className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold tracking-tight">RoMarket</span>
              </div>
              <p className="max-w-xs text-muted-foreground text-sm">
                Redefining the Roblox marketplace experience with trust, speed, and quality.
              </p>
            </div>
            
            <div className="flex gap-12">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Platform</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/marketplace" className="hover:text-primary transition-colors">Marketplace</Link></li>
                  <li><Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
                  <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Safety</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/terms" className="hover:text-primary transition-colors">Terms</Link></li>
                  <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link></li>
                  <li><Link href="/help" className="hover:text-primary transition-colors">Escrow Policy</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-border/50 text-center text-xs text-muted-foreground">
            © 2026 RoModerate Ecosystem. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
