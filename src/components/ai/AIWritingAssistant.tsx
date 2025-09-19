import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Wand2, 
  RefreshCw, 
  Sparkles, 
  Copy, 
  Check,
  Lightbulb,
  Target,
  Heart,
  Zap
} from 'lucide-react';

interface AIWritingAssistantProps {
  currentText: string;
  onTextChange: (text: string) => void;
  placeholder?: string;
  context?: {
    title?: string;
    category?: string;
    venue?: string;
    startDate?: string;
  };
}

type AssistantAction = 
  | 'improve' 
  | 'make_compelling' 
  | 'adjust_tone'
  | 'expand'
  | 'summarize'
  | 'generate_subject';

interface ActionConfig {
  label: string;
  icon: React.ReactNode;
  description: string;
  tone?: string;
}

const actions: Record<AssistantAction, ActionConfig> = {
  improve: {
    label: 'Improve',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Enhance clarity and engagement'
  },
  make_compelling: {
    label: 'Make Compelling',
    icon: <Target className="w-4 h-4" />,
    description: 'Add excitement and persuasion'
  },
  adjust_tone: {
    label: 'Professional Tone',
    icon: <Heart className="w-4 h-4" />,
    description: 'Adjust to professional tone',
    tone: 'professional'
  },
  expand: {
    label: 'Expand',
    icon: <Zap className="w-4 h-4" />,
    description: 'Add more detail and context'
  },
  summarize: {
    label: 'Summarize',
    icon: <RefreshCw className="w-4 h-4" />,
    description: 'Make more concise'
  },
  generate_subject: {
    label: 'Generate New',
    icon: <Lightbulb className="w-4 h-4" />,
    description: 'Generate fresh content'
  }
};

export function AIWritingAssistant({ 
  currentText, 
  onTextChange, 
  placeholder = "Describe your event...",
  context 
}: AIWritingAssistantProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleAIAction = async (action: AssistantAction) => {
    setIsLoading(true);
    setSuggestions([]);

    try {
      const { data, error } = await supabase.functions.invoke('ai-writing-assistant', {
        body: {
          action,
          text: currentText,
          context_title: context?.title,
          context_category: context?.category,
          context_venue: context?.venue,
          context_start_date: context?.startDate,
          tone: actions[action].tone
        }
      });

      if (error) throw error;

      if (action === 'generate_subject') {
        // For generate_subject, we get multiple suggestions
        setSuggestions(data.suggestions || [data.result]);
      } else {
        // For other actions, apply directly
        if (data.result) {
          onTextChange(data.result);
          toast({
            title: "Content updated",
            description: `Applied ${actions[action].label.toLowerCase()} enhancement`
          });
        }
      }
    } catch (error: any) {
      console.error('AI writing assistant error:', error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to enhance content",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast({
        title: "Copied!",
        description: "Text copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const applySuggestion = (suggestion: string) => {
    onTextChange(suggestion);
    setSuggestions([]);
    toast({
      title: "Applied!",
      description: "Suggestion applied to your content"
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Description</label>
          <div className="flex items-center gap-1">
            <Wand2 className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">AI-powered</span>
          </div>
        </div>
        
        <Textarea
          placeholder={placeholder}
          value={currentText}
          onChange={(e) => onTextChange(e.target.value)}
          className="min-h-32 resize-none"
        />
      </div>

      {/* AI Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(actions) as [AssistantAction, ActionConfig][]).map(([action, config]) => (
          <Button
            key={action}
            variant="outline"
            size="sm"
            onClick={() => handleAIAction(action)}
            disabled={isLoading || (!currentText && action !== 'generate_subject')}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              config.icon
            )}
            {config.label}
          </Button>
        ))}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI Suggestions</span>
            <Badge variant="secondary" className="text-xs">
              {suggestions.length} options
            </Badge>
          </div>
          
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm text-foreground mb-2">{suggestion}</p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => applySuggestion(suggestion)}
                    className="h-7 px-3 text-xs"
                  >
                    Use This
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(suggestion, index)}
                    className="h-7 px-2"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">AI is working...</span>
          </div>
        </div>
      )}
    </div>
  );
}