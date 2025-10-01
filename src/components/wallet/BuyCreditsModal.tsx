import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useWallet, CreditPackage } from "@/hooks/useWallet";

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BuyCreditsModal = ({ open, onOpenChange }: BuyCreditsModalProps) => {
  const { packages, purchaseCredits, isPurchasing } = useWallet();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState<string>("");
  const [promoCode, setPromoCode] = useState("");

  const handlePurchase = () => {
    if (selectedPackage === "custom") {
      const credits = parseInt(customCredits);
      if (!credits || credits < 1000) {
        return;
      }
      purchaseCredits({ custom_credits: credits, promo_code: promoCode || undefined });
    } else if (selectedPackage) {
      purchaseCredits({ package_id: selectedPackage, promo_code: promoCode || undefined });
    }
  };

  const getSelectedAmount = () => {
    if (selectedPackage === "custom") {
      const credits = parseInt(customCredits);
      return credits ? `$${(credits / 100).toFixed(2)}` : "$0.00";
    }
    const pkg = packages?.find((p) => p.id === selectedPackage);
    return pkg ? `$${(pkg.price_usd_cents / 100).toFixed(2)}` : "$0.00";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buy Credits</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
                      ${(pkg.price_usd_cents / 100).toFixed(2)}
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
                    type="number"
                    placeholder="Credits"
                    value={customCredits}
                    onChange={(e) => setCustomCredits(e.target.value)}
                    className="w-32"
                    min={1000}
                    step={100}
                    disabled={selectedPackage !== "custom"}
                  />
                </div>
              </Label>
            </div>
          </RadioGroup>

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
              <span>{getSelectedAmount()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Fees & taxes:</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between font-medium text-lg pt-2 border-t">
              <span>Total:</span>
              <span>{getSelectedAmount()}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePurchase}
              disabled={!selectedPackage || isPurchasing}
              className="flex-1"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${getSelectedAmount()}`
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