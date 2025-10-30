import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReconciliationButtonProps {
  campaignId: string;
  onComplete?: () => void;
}

export function ReconciliationButton({ campaignId, onComplete }: ReconciliationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleReconcile = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('trigger_campaign_reconciliation', {
        p_campaign_id: campaignId
      });

      if (error) throw error;

      setResult(data);

      if (data.missing_impressions > 0 || data.missing_clicks > 0) {
        toast({
          title: '✅ Reconciliation Complete',
          description: `Fixed ${data.missing_impressions} impressions, ${data.missing_clicks} clicks. Charged ${data.credits_charged} credits.`,
          variant: 'default',
        });
      } else {
        toast({
          title: '✅ No Issues Found',
          description: 'All impressions and clicks are properly charged.',
          variant: 'default',
        });
      }

      onComplete?.();
    } catch (error: any) {
      console.error('Reconciliation error:', error);
      toast({
        title: '❌ Reconciliation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleReconcile}
        disabled={loading}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Reconciling...' : 'Reconcile Charges'}
      </Button>

      {result && (
        <div className="flex items-center gap-1 text-sm">
          {result.missing_impressions > 0 || result.missing_clicks > 0 ? (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-amber-600">
                Fixed {result.missing_impressions} impressions
              </span>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-green-600">All charges verified</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

