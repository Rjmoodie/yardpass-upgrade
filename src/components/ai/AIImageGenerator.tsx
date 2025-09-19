import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Image as ImageIcon, Settings2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface AIImageGeneratorProps {
  title?: string;
  category?: string;
  city?: string;
  /** Called with the returned image URL (public URL or data: URI) */
  onDone: (url?: string) => void;
  /** Supabase function path (default "ai-image-generator") */
  invokePath?: string;
}

export const AIImageGenerator: React.FC<AIImageGeneratorProps> = ({
  title,
  category,
  city,
  onDone,
  invokePath = 'ai-image-generator',
}) => {
  const [open, setOpen] = React.useState(false);
  const [style, setStyle] = React.useState('vibrant poster');
  const [prompt, setPrompt] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(invokePath, {
        body: {
          title,
          category,
          city,
          style,
          prompt,
          save_to_storage: true, // return a public URL if configured on server
        },
      });
      if (error) throw new Error(error.message);
      onDone((data as any)?.image_url);
      setOpen(false);
    } catch (e) {
      console.error('[AIImageGenerator] error:', e);
      onDone(undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ImageIcon className="w-4 h-4 mr-1" />
          AI Banner
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <Settings2 className="w-4 h-4" /> Generate Cover
          </div>
          <Input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="Style (e.g., vibrant poster, minimal, neon, vintage)"
          />
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional extra details for the image"
          />
          <Button onClick={generate} disabled={loading} className="w-full">
            <Sparkles className="w-4 h-4 mr-1" />
            {loading ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};