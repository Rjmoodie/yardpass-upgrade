import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, AlertTriangle, ShieldAlert, Plus } from "lucide-react";
import { BuyCreditsModal } from "./BuyCreditsModal";
import { WalletTransactionsTable } from "./WalletTransactionsTable";
import { useWallet } from "@/hooks/useWallet";
import { Skeleton } from "@/components/ui/skeleton";

export const WalletDashboard = () => {
  const { wallet, isLoading, isLowBalance, isFrozen } = useWallet();
  const [showBuyModal, setShowBuyModal] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!wallet) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Unable to load wallet. Please try again.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status alerts */}
      {isFrozen && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Wallet is frozen due to a dispute. Campaigns are paused. Contact support for help.
          </AlertDescription>
        </Alert>
      )}

      {isLowBalance && !isFrozen && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Low balance ({wallet.balance_credits.toLocaleString()} credits). Top up to keep campaigns running.
          </AlertDescription>
        </Alert>
      )}

      {/* Balance card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              <CardTitle>Wallet</CardTitle>
            </div>
            <Button onClick={() => setShowBuyModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Buy Credits
            </Button>
          </div>
          <CardDescription>
            Manage your ad credits and view transaction history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  {wallet.balance_credits.toLocaleString()}
                </span>
                <span className="text-muted-foreground">credits</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                = {wallet.usd_equiv} USD
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={wallet.status === "active" ? "default" : "destructive"}>
                {wallet.status}
              </Badge>
              {wallet.auto_reload_enabled && (
                <Badge variant="outline">Auto-reload enabled</Badge>
              )}
            </div>

            {wallet.balance_credits === 0 && (
              <Alert>
                <AlertDescription>
                  You have 0 credits. Add credits to launch campaigns.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest wallet transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <WalletTransactionsTable transactions={wallet.recent_transactions} />
        </CardContent>
      </Card>

      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </div>
  );
};