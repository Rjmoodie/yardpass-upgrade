import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertTriangle, Settings } from 'lucide-react';

interface RefundPolicy {
  event_id: string;
  allow_refunds: boolean;
  refund_window_hours: number;
  auto_approve_enabled: boolean;
  refund_fees: boolean;
  partial_refunds_allowed: boolean;
}

interface RefundSettingsPanelProps {
  eventId: string;
}

export function RefundSettingsPanel({ eventId }: RefundSettingsPanelProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<RefundPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [eventId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('refund_policies')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setSettings(data || {
        event_id: eventId,
        allow_refunds: true,
        refund_window_hours: 24,
        auto_approve_enabled: false,
        refund_fees: true,
        partial_refunds_allowed: false
      });
    } catch (error: any) {
      console.error('Error fetching refund settings:', error);
      toast({
        title: 'Error loading settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<RefundPolicy>) => {
    setSaving(true);
    try {
      const newSettings = { ...settings, ...updates };

      const { error } = await supabase
        .from('refund_policies')
        .upsert({
          event_id: eventId,
          allow_refunds: newSettings.allow_refunds,
          refund_window_hours: newSettings.refund_window_hours,
          auto_approve_enabled: newSettings.auto_approve_enabled,
          refund_fees: newSettings.refund_fees,
          partial_refunds_allowed: newSettings.partial_refunds_allowed,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSettings(newSettings as RefundPolicy);

      toast({
        title: 'Settings Updated',
        description: 'Refund settings saved successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoApprove = async (enabled: boolean) => {
    await updateSettings({ auto_approve_enabled: enabled });
    
    toast({
      title: enabled ? 'Auto-Approve Enabled' : 'Auto-Approve Disabled',
      description: enabled 
        ? 'Safe refund requests will be approved automatically'
        : 'All refund requests will require your manual review'
    });
  };

  const handleRefundWindowChange = async (hours: number) => {
    if (hours < 1 || hours > 168) return;
    await updateSettings({ refund_window_hours: hours });
  };

  const handleAllowRefundsToggle = async (enabled: boolean) => {
    await updateSettings({ allow_refunds: enabled });
    
    toast({
      title: enabled ? 'Refunds Enabled' : 'Refunds Disabled',
      description: enabled
        ? 'Customers can now request refunds for this event'
        : 'Refunds are disabled for this event'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Refund Automation
        </CardTitle>
        <CardDescription>
          Configure how refund requests are handled for this event
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Auto-Approve Toggle */}
        <div className="flex items-start justify-between space-x-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Auto-Approve Safe Refunds</label>
              <Badge variant={settings?.auto_approve_enabled ? "success" : "neutral"}>
                {settings?.auto_approve_enabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Automatically approve refund requests that meet safety criteria. 
              Edge cases still require your review.
            </p>
          </div>
          <Switch
            checked={settings?.auto_approve_enabled || false}
            onCheckedChange={handleToggleAutoApprove}
            disabled={saving}
          />
        </div>

        {/* Auto-Approve Rules (shown when enabled) */}
        {settings?.auto_approve_enabled && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-900">
              <p className="font-semibold mb-2">✅ Auto-Approve Criteria (All must pass)</p>
              <ul className="text-xs space-y-1 ml-4">
                <li>• More than 48 hours before event starts</li>
                <li>• No tickets have been scanned/redeemed</li>
                <li>• Order placed within last 30 days</li>
                <li>• Customer has fewer than 3 refunds in 90 days</li>
                <li>• Order amount is under $500</li>
              </ul>
              <p className="text-xs mt-2 text-green-700">
                Requests not meeting these criteria will appear in "Pending Requests" for your review.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Manual Review Info (shown when disabled) */}
        {!settings?.auto_approve_enabled && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Manual Review Mode:</strong> All refund requests will appear in your 
              "Pending Requests" tab for review. You'll need to approve or decline each one.
            </AlertDescription>
          </Alert>
        )}

        {/* Additional Settings */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Refund Window</label>
              <p className="text-xs text-muted-foreground">
                Hours before event when refunds are no longer allowed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="168"
                value={settings?.refund_window_hours || 24}
                onChange={(e) => {
                  const hours = parseInt(e.target.value) || 24;
                  handleRefundWindowChange(hours);
                }}
                onBlur={(e) => {
                  const hours = parseInt(e.target.value) || 24;
                  if (hours !== settings?.refund_window_hours) {
                    handleRefundWindowChange(hours);
                  }
                }}
                className="w-20 text-right"
                disabled={saving}
              />
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Allow Refunds</label>
              <p className="text-xs text-muted-foreground">
                Enable or disable refunds entirely for this event
              </p>
            </div>
            <Switch
              checked={settings?.allow_refunds ?? true}
              onCheckedChange={handleAllowRefundsToggle}
              disabled={saving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



