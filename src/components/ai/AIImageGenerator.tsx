import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  ImageIcon, 
  RefreshCw, 
  Sparkles, 
  Download,
  Wand2,
  Palette,
  Camera,
  Sun
} from 'lucide-react';

interface AIImageGeneratorProps {
  onImageGenerated: (imageUrl: string) => void;
  context?: {
    title?: string;
    category?: string;
    description?: string;
    venue?: string;
  };
}

const stylePresets = [
  { 
    name: 'Event Photography', 
    icon: <Camera className="w-4 h-4" />, 
    prompt: 'professional event photography style, vibrant, engaging' 
  },
  { 
    name: 'Modern Minimalist', 
    icon: <Palette className="w-4 h-4" />, 
    prompt: 'clean modern minimalist design, simple elegant layout' 
  },
  { 
    name: 'Vibrant & Energetic', 
    icon: <Sun className="w-4 h-4" />, 
    prompt: 'vibrant colorful energetic design, dynamic composition' 
  },
  { 
    name: 'Premium Elegant', 
    icon: <Sparkles className="w-4 h-4" />, 
    prompt: 'premium elegant sophisticated design, luxury aesthetic' 
  }
];

export function AIImageGenerator({ onImageGenerated, context }: AIImageGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  const generateContextualPrompt = (stylePrompt?: string) => {
    let prompt = '';
    
    if (context?.title) {
      prompt += `Event cover image for "${context.title}". `;
    }
    
    if (context?.category) {
      prompt += `${context.category} event theme. `;
    }
    
    if (context?.description) {
      // Extract key themes from description
      const description = context.description.toLowerCase();
      if (description.includes('music')) prompt += 'Musical theme. ';
      if (description.includes('food')) prompt += 'Culinary theme. ';
      if (description.includes('art')) prompt += 'Artistic theme. ';
      if (description.includes('outdoor')) prompt += 'Outdoor setting. ';
      if (description.includes('festival')) prompt += 'Festival atmosphere. ';
    }
    
    if (stylePrompt) {
      prompt += stylePrompt + '. ';
    }
    
    prompt += 'High quality, professional, suitable for event marketing, 16:9 aspect ratio, ultra high resolution';
    
    return prompt;
  };

  const generateImage = async (prompt: string) => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-image-generator', {
        body: {
          prompt,
          width: 1024,
          height: 576, // 16:9 aspect ratio
          quality: 'high'
        }
      });

      if (error) throw error;

      if (data?.imageUrl || data?.image) {
        const imageUrl = data.imageUrl || data.image;
        setGeneratedImages(prev => [imageUrl, ...prev.slice(0, 2)]); // Keep last 3 images
        
        toast({
          title: "Image generated!",
          description: "AI has created your event cover image"
        });
      }
    } catch (error: any) {
      console.error('AI image generation error:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate image",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStylePreset = (stylePrompt: string) => {
    const fullPrompt = generateContextualPrompt(stylePrompt);
    generateImage(fullPrompt);
  };

  const handleCustomGenerate = () => {
    if (!customPrompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a description for your image",
        variant: "destructive"
      });
      return;
    }
    
    const fullPrompt = customPrompt + ', high quality, professional, suitable for event marketing, ultra high resolution';
    generateImage(fullPrompt);
  };

  const useImage = (imageUrl: string) => {
    onImageGenerated(imageUrl);
    toast({
      title: "Image applied!",
      description: "Cover image has been set for your event"
    });
  };

  const downloadImage = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event-cover-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Downloaded!",
        description: "Image saved to your device"
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the image",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Wand2 className="w-5 h-5 text-primary" />
        <h3 className="font-medium">AI Image Generator</h3>
        <Badge variant="secondary" className="text-xs">Powered by AI</Badge>
      </div>

      {/* Context-aware quick options */}
      {context && (
        <Card className="p-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Smart Suggestions
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {stylePresets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleStylePreset(preset.prompt)}
                  disabled={isGenerating}
                  className="justify-start gap-2 h-auto py-2"
                >
                  {preset.icon}
                  <span className="text-xs">{preset.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Custom prompt */}
      <Card className="p-4">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Custom Description</h4>
          <div className="flex gap-2">
            <Input
              placeholder="Describe the image you want..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCustomGenerate()}
            />
            <Button 
              onClick={handleCustomGenerate} 
              disabled={isGenerating || !customPrompt.trim()}
              className="shrink-0"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Generated images */}
      {generatedImages.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3">Generated Images</h4>
          <div className="space-y-3">
            {generatedImages.map((imageUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={imageUrl}
                  alt={`Generated option ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => useImage(imageUrl)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Use Image
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadImage(imageUrl)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isGenerating && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>AI is creating your image...</span>
          </div>
        </div>
      )}
    </div>
  );
}