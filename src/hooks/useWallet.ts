import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WalletData {
  id: string;
  balance_credits: number;
  usd_equiv: number;
  low_balance_threshold: number;
  auto_reload_enabled: boolean;
  auto_reload_topup_credits: number | null;
  status: "active" | "frozen";
  recent_transactions: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  type: "purchase" | "spend" | "refund" | "adjustment" | "promo";
  credits_delta: number;
  usd_cents?: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
  memo?: string | null;
  created_at: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_usd_cents: number;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

type PurchaseArgs =
  | { package_id: string; promo_code?: string }
  | { custom_credits: number; promo_code?: string };

export const useWallet = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallet, isLoading, error } = useQuery<WalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-wallet");
      if (error) throw error;
      // Ensure usd_equiv is a number and provide defaults
      return {
        ...data,
        usd_equiv: typeof data.usd_equiv === 'string' ? parseFloat(data.usd_equiv) : (data.usd_equiv || 0),
        recent_transactions: data.recent_transactions || [],
      };
    },
  });

  const { data: packages, isLoading: isLoadingPackages } = useQuery<CreditPackage[]>({
    queryKey: ["credit-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (args: PurchaseArgs) => {
      const body = 'package_id' in args 
        ? { package_id: args.package_id, promo_code: args.promo_code }
        : { custom_credits: args.custom_credits, promo_code: args.promo_code };
      
      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke("purchase-credits", {
        body,
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Refetch wallet after successful purchase initiation
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      // Redirect to Stripe checkout
      if (data.session_url) {
        window.location.href = data.session_url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const autoReloadMutation = useMutation({
    mutationFn: async ({
      enabled,
      threshold,
      topup_credits,
      payment_method_id,
    }: {
      enabled: boolean;
      threshold?: number;
      topup_credits?: number;
      payment_method_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("wallet-auto-reload", {
        body: { enabled, threshold, topup_credits, payment_method_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast({
        title: "Auto-reload updated",
        description: "Your settings have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLowBalance =
    wallet && wallet.balance_credits < wallet.low_balance_threshold;

  const isFrozen = wallet?.status === "frozen";

  return {
    wallet,
    packages: packages || [],
    isLoading,
    isLoadingPackages,
    error,
    isLowBalance,
    isFrozen,
    purchaseCredits: purchaseMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    updateAutoReload: autoReloadMutation.mutate,
    isUpdatingAutoReload: autoReloadMutation.isPending,
  };
};