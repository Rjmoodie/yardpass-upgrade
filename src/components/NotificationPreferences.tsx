import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface NotificationPreferences {
  push_messages: boolean;
  push_tickets: boolean;
  push_social: boolean;
  push_marketing: boolean;
}

export function NotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    push_messages: true,
    push_tickets: true,
    push_social: true,
    push_marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setPreferences({
            push_messages: data.push_messages ?? true,
            push_tickets: data.push_tickets ?? true,
            push_social: data.push_social ?? true,
            push_marketing: data.push_marketing ?? false,
          });
        }
      } catch (error) {
        console.error('[NotificationPreferences] Error loading preferences:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notification preferences',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          push_messages: preferences.push_messages,
          push_tickets: preferences.push_tickets,
          push_social: preferences.push_social,
          push_marketing: preferences.push_marketing,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated',
      });
    } catch (error) {
      console.error('[NotificationPreferences] Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading preferences...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push Notification Preferences</CardTitle>
        <CardDescription>
          Choose which types of notifications you want to receive as push notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-messages">Messages</Label>
            <p className="text-sm text-muted-foreground">
              Get notified when you receive new messages
            </p>
          </div>
          <Switch
            id="push-messages"
            checked={preferences.push_messages}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, push_messages: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-tickets">Tickets</Label>
            <p className="text-sm text-muted-foreground">
              Get notified about ticket purchases and updates
            </p>
          </div>
          <Switch
            id="push-tickets"
            checked={preferences.push_tickets}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, push_tickets: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-social">Social</Label>
            <p className="text-sm text-muted-foreground">
              Get notified about likes, comments, and follows
            </p>
          </div>
          <Switch
            id="push-social"
            checked={preferences.push_social}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, push_social: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-marketing">Marketing</Label>
            <p className="text-sm text-muted-foreground">
              Get notified about promotions and special offers
            </p>
          </div>
          <Switch
            id="push-marketing"
            checked={preferences.push_marketing}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, push_marketing: checked })
            }
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}

