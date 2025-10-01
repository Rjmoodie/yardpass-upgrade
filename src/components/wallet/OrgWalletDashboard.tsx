import { useOrgWallet } from "@/hooks/useOrgWallet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { OrgBuyCreditsModal } from "./OrgBuyCreditsModal";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface OrgWalletDashboardProps {
  orgId: string;
}

export const OrgWalletDashboard = ({ orgId }: OrgWalletDashboardProps) => {
  const { wallet, packages, isLoading, isLowBalance, isFrozen, purchaseCredits, isPurchasing } =
    useOrgWallet(orgId);
  const [showBuyModal, setShowBuyModal] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Wallet</CardTitle>
          <CardDescription>No wallet found for this organization</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            A wallet will be created automatically when you make your first purchase.
          </p>
          <Button onClick={() => setShowBuyModal(true)} className="mt-4">
            Buy Credits
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {isFrozen && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This wallet has been frozen due to a payment issue. Please contact support.
          </AlertDescription>
        </Alert>
      )}

      {isLowBalance && !isFrozen && wallet && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your balance is below the threshold ({wallet.low_balance_threshold} credits). Consider
            reloading credits.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Organization Wallet Balance
          </CardTitle>
          <CardDescription>Manage your organization's ad credits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-4xl font-bold">
                {(wallet?.balance_credits ?? 0).toLocaleString()} credits
              </div>
              <div className="text-sm text-muted-foreground">
                ≈ ${(wallet?.usd_equiv ?? 0).toFixed(2)} USD
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setShowBuyModal(true)} disabled={isFrozen}>
                Buy Credits
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Last 20 wallet transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {!wallet?.recent_transactions || wallet.recent_transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {wallet.recent_transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {tx.credits_delta > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium capitalize">{tx.transaction_type}</div>
                      <div className="text-sm text-muted-foreground">
                        {tx.description || new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-semibold ${
                      tx.credits_delta > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.credits_delta > 0 ? "+" : ""}
                    {tx.credits_delta} credits
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrgBuyCreditsModal
        open={showBuyModal}
        onOpenChange={setShowBuyModal}
        packages={packages}
        onPurchase={purchaseCredits}
        isPurchasing={isPurchasing}
        isLoadingPackages={isLoading}
      />
    </div>
  );
};