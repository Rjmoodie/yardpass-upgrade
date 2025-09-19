import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Tone = 'friendly' | 'professional' | 'urgent' | 'casual';

export interface AIWritingAssistantProps {
  /** Context you want to give the model (orgId, title, category, city, date, etc.) */
  context?: Record<string, any>;
  /** Improve/replace the description text in parent */
  onImprove: (text: string) => void;
  /** Generate a title and send it back to parent */
  onGenerateTitle?: (title: string) => void;
  /** Supabase Function name/path (e.g. "ai-writing-assistant") */
  invokePath?: string;
  /** Optional className for container */
  className?: string;
}

/**
 * Small helper that calls your ai-writing-assistant edge function with:
 * { action: 'improve' | 'generate_title' | 'adjust_tone', text?, context?, tone? }
 * Expected response: { text: string }
 */
export const AIWritingAssistant: React.FC<AIWritingAssistantProps> = ({
  context,
  onImprove,
  onGenerateTitle,
  invokePath = 'ai-writing-assistant',
  className,
}) => {
  const [tone, setTone] = React.useState<Tone>('friendly');
  const [loading, setLoading] = React.useState<'improve' | 'title' | null>(null);

  const callAI = async (payload: any) => {
    const { data, error } = await supabase.functions.invoke(invokePath, { body: payload });
    if (error) throw new Error(error.message);
    return data as { text?: string };
  };

  const improve = async () => {
    const text = (context as any)?.draft || (context as any)?.description;
    if (!text || !text.trim()) return;
    setLoading('improve');
    try {
      const res = await callAI({ action: 'improve', text, context, tone });
      if (res?.text) onImprove(res.text);
    } catch (e) {
      console.error('[AIWritingAssistant] improve failed:', e);
    } finally {
      setLoading(null);
    }
  };

  const generateTitle = async () => {
    setLoading('title');
    try {
      const seed = (context as any)?.title ?? '';
      const res = await callAI({ action: 'generate_title', text: seed, context, tone });
      if (res?.text && onGenerateTitle) onGenerateTitle(res.text);
    } catch (e) {
      console.error('[AIWritingAssistant] generateTitle failed:', e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={tone} onValueChange={(v: Tone) => setTone(v)}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Tone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="friendly">Friendly</SelectItem>
          <SelectItem value="professional">Professional</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="casual">Casual</SelectItem>
        </SelectContent>
      </Select>

      <Button size="sm" variant="secondary" onClick={improve} disabled={loading !== null}>
        <Wand2 className="w-4 h-4 mr-1" />
        {loading === 'improve' ? 'Improving…' : 'Improve'}
      </Button>

      {onGenerateTitle && (
        <Button size="sm" variant="outline" onClick={generateTitle} disabled={loading !== null}>
          <Sparkles className="w-4 h-4 mr-1" />
          {loading === 'title' ? 'Creating…' : 'Title'}
        </Button>
      )}
    </div>
  );
};