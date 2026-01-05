import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Store,
  Star,
  ShoppingBag,
  Grid3X3,
  TrendingUp,
  Shield,
  CheckCircle2
} from "lucide-react";
import type { MarketplaceListing } from "../../../shared/schema";

export default function MarketplaceSeller() {
  const [, params] = useRoute("/marketplace/seller/:id");
  const [, setLocation] = useLocation();

  const { data: listings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/listings", { sellerId: params?.id }],
    enabled: !!params?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={() => setLocation("/marketplace")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Seller Header */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-3xl">S</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">Verified Seller</h1>
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="font-medium">4.9</span>
                    <span>(234 reviews)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShoppingBag className="h-4 w-4" />
                    <span>{listings.length} active listings</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm">Trusted seller with escrow protection</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Listings */}
        <Tabs defaultValue="active">
          <TabsList className="mb-6">
            <TabsTrigger value="active" data-testid="tab-active">
              Active Listings ({listings.filter(l => l.status === "active").length})
            </TabsTrigger>
            <TabsTrigger value="sold" data-testid="tab-sold">
              Sold Items
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {listings.filter(l => l.status === "active").length === 0 ? (
              <div className="text-center py-20">
                <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No active listings</h3>
                <p className="text-muted-foreground">This seller currently has no active items for sale.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {listings
                  .filter((l) => l.status === "active")
                  .map((listing) => (
                    <Card
                      key={listing.id}
                      className="group overflow-hidden hover-elevate cursor-pointer transition-all border-2 hover:border-primary/50"
                      onClick={() => setLocation(`/marketplace/listing/${listing.id}`)}
                      data-testid={`card-listing-${listing.id}`}
                    >
                      <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10">
                        {listing.images && listing.images.length > 0 ? (
                          <img
                            src={listing.images[0]}
                            alt={listing.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Grid3X3 className="h-20 w-20 text-muted-foreground/30" />
                          </div>
                        )}
                        {listing.viewCount > 100 && (
                          <Badge className="absolute top-3 left-3 gap-1 bg-primary/90 backdrop-blur-sm">
                            <TrendingUp className="h-3 w-3" />
                            Trending
                          </Badge>
                        )}
                        <Badge variant="secondary" className="absolute top-3 right-3 backdrop-blur-sm">
                          {listing.category}
                        </Badge>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                            {listing.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {listing.description}
                          </p>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold">
                            {listing.price.toLocaleString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {listing.currency}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sold">
            <div className="text-center py-20">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No sold items</h3>
              <p className="text-muted-foreground">Sold items will appear here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
