import { supabase } from '@/integrations/supabase/client';

export async function fetchOrgEvents({ orgId, page = 1, limit = 100 }:{
  orgId: string | null, page?: number, limit?: number
}) {
  if (!orgId) return [];
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error } = await supabase
    .from('events.events')
    .select('*')
    .eq('owner_context_id', orgId)
    .order('start_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return data ?? [];
}
