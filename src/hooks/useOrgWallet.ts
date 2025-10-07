import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface OrgWalletData {
  id: string;
  balance_credits: number;
  usd_equiv: number;
  low_balance_threshold: number;
  auto_reload_enabled: boolean;
  auto_reload_topup_credits: number | null;
  status: "active" | "frozen";
  recent_transactions: OrgWalletTransaction[];
}

export interface OrgWalletTransaction {
  id: string;
  transaction_type: "purchase" | "spend" | "refund" | "adjustment";
  credits_delta: number;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
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

export const useOrgWallet = (orgId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallet, isLoading, error } = useQuery<OrgWalletData | null>({
    queryKey: ["org-wallet", orgId],
    queryFn: async () => {
      const response = await api.getOrgWallet(orgId);

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.data) {
        return null;
      }

      return response.data as OrgWalletData;
    },
    enabled: !!orgId,
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
        ? { org_id: orgId, package_id: args.package_id, promo_code: args.promo_code }
        : { org_id: orgId, custom_credits: args.custom_credits, promo_code: args.promo_code };
      
      const { data, error } = await supabase.functions.invoke("purchase-org-credits", {
        body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["org-wallet", orgId] });
      // Open Stripe checkout in a new tab (required for iframe environments)
      if (data.session_url) {
        window.open(data.session_url, '_blank');
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
  };
};