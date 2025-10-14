import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BrandedSpinner } from '../BrandedSpinner';
import { useWallet } from "@/hooks/useWallet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BuyCreditsModal = ({ open, onOpenChange }: BuyCreditsModalProps) => {
  const { packages, purchaseCredits, isPurchasing, isLoadingPackages } = useWallet();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState<string>("");
  const [promoCode, setPromoCode] = useState("");

  // Reset local state when the modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedPackage(null);
      setCustomCredits("");
      setPromoCode("");
    }
  }, [open]);

  const selectedAmountCents = useMemo(() => {
    if (selectedPackage === "custom") {
      const credits = Number(customCredits);
      return Number.isFinite(credits) && credits >= 1000 ? credits : 0; // 1 credit = 1 cent
    }
    const pkg = packages?.find((p) => p.id === selectedPackage);
    return pkg ? pkg.price_usd_cents : 0;
  }, [selectedPackage, customCredits, packages]);

  const formattedTotal = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(selectedAmountCents / 100),
    [selectedAmountCents]
  );

  const handlePurchase = async () => {
    try {
      if (selectedPackage === "custom") {
        const credits = Number(customCredits);
        if (!Number.isFinite(credits) || credits < 1000) return;
        await purchaseCredits({ custom_credits: credits, promo_code: promoCode || undefined });
      } else if (selectedPackage) {
        await purchaseCredits({ package_id: selectedPackage, promo_code: promoCode || undefined });
      }
      toast({ title: "Purchase started", description: "We'll update your balance once payment completes." });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Payment failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    }
  };

  const disabled = isPurchasing || selectedAmountCents <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-description="Choose a credit package and complete payment">
        <DialogHeader>
          <DialogTitle>Buy Credits</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isLoadingPackages ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <RadioGroup value={selectedPackage || ""} onValueChange={setSelectedPackage}>
              {packages?.map((pkg) => (
              <div key={pkg.id} className="flex items-center space-x-2">
                <RadioGroupItem value={pkg.id} id={pkg.id} />
                <Label htmlFor={pkg.id} className="flex-1 cursor-pointer">
                  <div className="flex justify-between items-center">
                    <span>
                      {pkg.credits.toLocaleString()} credits
                      {pkg.is_default && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Popular
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(pkg.price_usd_cents / 100)}
                    </span>
                  </div>
                </Label>
              </div>
            ))}

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>Custom:</span>
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      type="number"
                      placeholder="Credits"
                      value={customCredits}
                      onChange={(e) => setCustomCredits(e.target.value)}
                      className="w-32"
                      min={1000}
                      step={100}
                      disabled={selectedPackage !== "custom"}
                    />
                    <span className="text-sm text-muted-foreground">
                      =
                      {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
                        (Number(customCredits) || 0) / 100
                      )}
                    </span>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          )}

          <div>
            <Label htmlFor="promo">Promo code (optional)</Label>
            <Input
              id="promo"
              placeholder="Enter code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
            />
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formattedTotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Fees & taxes:</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between font-medium text-lg pt-2 border-t">
              <span>Total:</span>
              <span>{formattedTotal}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePurchase}
              disabled={disabled}
              className="flex-1"
            >
              {isPurchasing ? (
                <>
                  <BrandedSpinner size="sm" />
                  Processing…
                </>
              ) : (
                `Pay ${formattedTotal}`
              )}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Trusted by organizers • Encrypted payments
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};