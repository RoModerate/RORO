import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Upload, 
  X, 
  Sparkles, 
  Image as ImageIcon, 
  AlertCircle, 
  Eye, 
  CheckCircle2, 
  Tag, 
  Coins,
  Globe,
  Info
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertMarketplaceListingSchema, type User } from "../../../shared/schema";
import imageCompression from 'browser-image-compression';
import { TosAcceptanceModal } from "@/components/tos-acceptance-modal";
import { PublicNav } from "@/components/public-nav";

const createListingSchema = insertMarketplaceListingSchema.omit({ sellerId: true });

export default function MarketplaceCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showTosModal, setShowTosModal] = useState(false);
  const [tosJustAccepted, setTosJustAccepted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (user && !user.tosAcceptedAt && !tosJustAccepted) {
      setShowTosModal(true);
    }
  }, [user, tosJustAccepted]);

  const form = useForm<z.infer<typeof createListingSchema>>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      currency: "robux",
      category: "ugc",
      itemType: "ugc-item",
      tags: [],
      images: [],
      status: "active",
    },
  });

  const formData = form.watch();

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createListingSchema>) => {
      return apiRequest("POST", "/api/marketplace/listings", { ...data, tags });
    },
    onSuccess: (data: any) => {
      toast({ title: "Listing Created!", description: "Your item is now live." });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      setLocation(`/marketplace/listing/${data.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create listing.", variant: "destructive" });
    },
  });

  const addTag = () => {
    if (currentTag && !tags.includes(currentTag) && tags.length < 10) {
      setTags([...tags, currentTag]);
      setCurrentTag("");
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const newImages: string[] = [];
      for (const file of Array.from(files)) {
        const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(compressedFile);
        });
        newImages.push(base64);
      }
      const updatedImages = [...uploadedImages, ...newImages].slice(0, 5);
      setUploadedImages(updatedImages);
      form.setValue('images', updatedImages);
    } catch (error) {
      toast({ title: "Upload Failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(updatedImages);
    form.setValue('images', updatedImages);
  };

  const onSubmit = (data: z.infer<typeof createListingSchema>) => createMutation.mutate(data);

  return (
    <div className="min-h-screen bg-background pb-20">
      <PublicNav />

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              List Your Asset
            </h1>
            <p className="text-muted-foreground text-lg">Create a professional listing and reach global creators.</p>
          </div>

          <div className="flex items-center gap-3 bg-card/50 p-3 rounded-2xl border border-border/50 backdrop-blur-md">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={`https://cdn.discordapp.com/avatars/${user?.discordId}/${user?.avatar}.png`} />
              <AvatarFallback>{user?.username?.[0]}</AvatarFallback>
            </Avatar>
            <div className="pr-4">
              <div className="text-sm font-bold leading-tight">{user?.username}</div>
              <div className="text-[10px] text-primary font-bold uppercase tracking-widest">Verified Seller</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Form Side */}
          <div className="flex-1 space-y-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Basic Details */}
                <Card className="rounded-3xl border-border/50 bg-card/30 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-border/50 bg-muted/20 pb-6">
                    <div className="flex items-center gap-2 text-primary">
                      <Info className="h-5 w-5" />
                      <CardTitle className="text-xl">Basic Information</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Advanced Combat System Pro" className="h-12 rounded-xl bg-background" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Detail the features and requirements..." className="min-h-[160px] rounded-2xl bg-background resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 rounded-xl bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="ugc">UGC Assets</SelectItem>
                                <SelectItem value="plugins">Plugins</SelectItem>
                                <SelectItem value="scripts">Scripts</SelectItem>
                                <SelectItem value="models">Models</SelectItem>
                                <SelectItem value="game-passes">Game Passes</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Price</FormLabel>
                            <div className="relative">
                              <Coins className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                              <Input 
                                type="number" 
                                className="h-12 pl-12 rounded-xl bg-background" 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Media */}
                <Card className="rounded-3xl border-border/50 bg-card/30 shadow-sm">
                  <CardHeader className="border-b border-border/50 bg-muted/20 pb-6">
                    <div className="flex items-center gap-2 text-primary">
                      <ImageIcon className="h-5 w-5" />
                      <CardTitle className="text-xl">Media Gallery</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleImageUpload(e.dataTransfer.files); }}
                      className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all ${isDragging ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30 bg-background/50"}`}
                    >
                      <Upload className="h-10 w-10 text-primary/50 mx-auto mb-4" />
                      <p className="text-sm font-bold mb-1">Drag and drop images here</p>
                      <p className="text-xs text-muted-foreground mb-4">Max 5 images, up to 5MB each</p>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                        Choose Files
                      </Button>
                      <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
                    </div>

                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-5 gap-3">
                        {uploadedImages.map((img, i) => (
                          <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-border/50">
                            <img src={img} className="w-full h-full object-cover" />
                            <button onClick={() => removeImage(i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <X className="h-4 w-4 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-4">
                  <Button type="submit" size="lg" className="flex-1 h-14 rounded-2xl shadow-xl shadow-primary/20 text-lg font-bold" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Publishing..." : "Publish Listing"}
                  </Button>
                  <Button type="button" variant="outline" size="lg" className="h-14 px-8 rounded-2xl border-border/50" onClick={() => setPreviewMode(!previewMode)}>
                    <Eye className="h-5 w-5 mr-2" />
                    Preview
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Preview Side */}
          <aside className="lg:w-[380px] space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-2">Live Preview</h3>
            <Card className="rounded-[2rem] border-border/50 bg-card shadow-2xl overflow-hidden sticky top-32">
              <div className="aspect-[4/3] bg-muted relative">
                {uploadedImages[0] ? (
                  <img src={uploadedImages[0]} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-20">
                    <ImageIcon className="h-12 w-12 mb-2" />
                    <span className="text-xs font-bold uppercase tracking-tighter">No Image</span>
                  </div>
                )}
                <Badge className="absolute top-5 left-5 bg-background/80 backdrop-blur-md text-foreground rounded-lg">
                  {formData.category}
                </Badge>
              </div>
              <CardContent className="p-8 space-y-6">
                <div>
                  <h4 className="text-2xl font-black mb-1 line-clamp-1">{formData.title || "Untitled Asset"}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Verified Listing
                  </div>
                </div>

                <div className="flex items-baseline justify-between py-4 border-y border-border/50">
                  <div className="text-3xl font-black text-primary">
                    {formData.price.toLocaleString()}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {formData.currency}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://cdn.discordapp.com/avatars/${user?.discordId}/${user?.avatar}.png`} />
                    <AvatarFallback>{user?.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{user?.username}</span>
                    <span className="text-[10px] text-muted-foreground">Seller Reputation: 100%</span>
                  </div>
                </div>

                <Button className="w-full rounded-2xl h-12 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 no-default-hover-elevate">
                  Purchase Details
                </Button>
              </CardContent>
            </Card>

            <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10">
              <div className="flex gap-3 mb-2">
                <Globe className="h-4 w-4 text-primary shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Market Visibility</h4>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your listing will be visible to thousands of potential buyers on the RoMarket homepage and search results immediately after publishing.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <TosAcceptanceModal
        open={showTosModal}
        onOpenChange={(open) => {
          if (!open && !tosJustAccepted) setLocation("/marketplace");
          setShowTosModal(open);
        }}
        onAccepted={() => setTosJustAccepted(true)}
      />
    </div>
  );
}
