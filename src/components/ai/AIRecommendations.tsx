import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { Lightbulb, PlusCircle } from 'lucide-react';

export interface TierSuggestion {
  name: string;
  price: number;
  badge: string;
  quantity: number;
}

export interface AIRecommendationsProps {
  orgId: string;
  city?: string;
  category?: string;
  eventDate?: string; // ISO date
  onApplyTiers: (tiers: TierSuggestion[]) => void;
  invokePath?: string; // default ai-event-recommendations
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({
  orgId,
  city,
  category,
  eventDate,
  onApplyTiers,
  invokePath = 'ai-event-recommendations',
}) => {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [tiers, setTiers] = React.useState<TierSuggestion[] | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(invokePath, {
        body: { org_id: orgId, city, category, event_date: eventDate },
      });
      if (error) throw new Error(error.message);
      setTiers(((data as any)?.tiers || []) as TierSuggestion[]);
    } catch (e) {
      console.error('[AIRecommendations] error:', e);
      setTiers(null);
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (tiers?.length) onApplyTiers(tiers);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (v) fetchSuggestions(); }}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Lightbulb className="w-4 h-4 mr-1" />
          Suggest tiers
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[420px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>AI Ticketing Suggestions</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {loading && <div className="text-sm text-muted-foreground">Analyzing similar events…</div>}
          {!loading && !tiers && (
            <div className="text-sm text-muted-foreground">No suggestions available.</div>
          )}
          {!loading && tiers && (
            <div className="space-y-3">
              {tiers.map((t, i) => (
                <div key={`${t.name}-${i}`} className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.name} <span className="text-xs text-muted-foreground">({t.badge})</span></div>
                    <div className="text-xs text-muted-foreground">{t.quantity} qty</div>
                  </div>
                  <div className="font-semibold">${Number(t.price ?? 0).toFixed(2)}</div>
                </div>
              ))}
              <Button onClick={apply} className="w-full">
                <PlusCircle className="w-4 h-4 mr-1" />
                Apply to event
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};