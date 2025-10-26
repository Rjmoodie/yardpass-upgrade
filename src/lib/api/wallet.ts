import { supabase } from '@/integrations/supabase/client';

export async function fetchWalletTx({ orgId, page, limit }:{
  orgId: string, page: number, limit: number
}) {
  const { data: wallet, error: wErr } = await supabase
    .schema('organizations')
    .from('org_wallets')
    .select('id')
    .eq('org_id', orgId)
    .single();
  if (wErr) throw wErr;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const [{ data: rows, error }, { count, error: cErr }] = await Promise.all([
    supabase
      .schema('organizations')
      .from('org_wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase
      .schema('organizations')
      .from('org_wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_id', wallet.id),
  ]);
  if (error) throw error;
  if (cErr) throw cErr;
  return { rows: rows ?? [], total: count ?? 0 };
}
