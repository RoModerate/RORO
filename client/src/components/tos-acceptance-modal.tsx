import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Shield, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface TosAcceptanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted?: () => void;
}

export function TosAcceptanceModal({ open, onOpenChange, onAccepted }: TosAcceptanceModalProps) {
  const [agreed, setAgreed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const acceptTosMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/user/accept-tos", "POST");
      console.log("TOS acceptance response:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("TOS accepted successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Terms Accepted",
        description: "You can now create listings and make purchases.",
      });
      onAccepted?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("TOS acceptance error:", error);
      toast({
        title: "Failed to Record Acceptance",
        description: "Please try again or contact support if the problem persists.",
        variant: "destructive",
      });
    },
  });

  const handleAccept = () => {
    if (!agreed) {
      toast({
        title: "Agreement Required",
        description: "Please check the box to confirm you've read and agree to the terms.",
        variant: "destructive",
      });
      return;
    }
    acceptTosMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" data-testid="dialog-tos-acceptance">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Marketplace Terms & Privacy</DialogTitle>
              <DialogDescription>
                Required before listing or purchasing items
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Important Notice</h3>
                  <p className="text-sm text-muted-foreground">
                    By using the RoModerate Marketplace, you agree to our comprehensive Terms of Service 
                    and Privacy Policy. Please review these documents carefully before proceeding.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-5">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Key Marketplace Terms
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>All transactions are protected by our secure escrow system (5% platform fee)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Sellers must deliver items within 48 hours of purchase</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Buyers have 72 hours to confirm receipt or funds auto-release</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Prohibited items: stolen assets, exploits, accounts, items violating Roblox TOS</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Disputes must be opened within 7 days and include evidence</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Maintain 80% completion rate to remain in good standing</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <h4 className="font-semibold text-foreground mb-3">Your Responsibilities</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">As a Seller:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Provide accurate descriptions</li>
                      <li>• Upload real item images (max 5)</li>
                      <li>• Own rights to listed items</li>
                      <li>• Respond to buyers promptly</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">As a Buyer:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Review listings carefully</li>
                      <li>• Complete payments via escrow</li>
                      <li>• Confirm receipt within 72h</li>
                      <li>• Leave honest reviews</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <h4 className="font-semibold text-foreground mb-3">Privacy & Data Collection</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>We collect transaction history, reviews, and marketplace activity</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Uploaded images are compressed and stored as base64 (5MB max each)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Usernames and ratings are publicly visible</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Transaction details are private except to involved parties and moderators</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Payment information is securely processed by third-party providers</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>Read the full documents:</span>
                <Link href="/terms" className="text-primary hover:underline" data-testid="link-full-terms">
                  Terms of Service
                </Link>
                <span>•</span>
                <Link href="/privacy" className="text-primary hover:underline" data-testid="link-full-privacy">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t pt-4">
          <div className="flex items-start gap-3 mb-4">
            <Checkbox
              id="tos-agree"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
              className="mt-1"
              data-testid="checkbox-tos-agree"
            />
            <label
              htmlFor="tos-agree"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I confirm that I have read, understood, and agree to the{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              , including all marketplace rules, escrow terms, and data collection practices.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={acceptTosMutation.isPending}
            data-testid="button-tos-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!agreed || acceptTosMutation.isPending}
            data-testid="button-tos-accept"
          >
            {acceptTosMutation.isPending ? "Processing..." : "Accept & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
