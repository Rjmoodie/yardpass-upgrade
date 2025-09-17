import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Star, ExternalLink } from 'lucide-react';
import { getSocialIcon } from '@/utils/socialIcons';

export interface SocialLink {
  platform: string;
  url: string;
  is_primary: boolean;
}

interface SocialLinkManagerProps {
  socialLinks: SocialLink[];
  onChange: (links: SocialLink[]) => void;
  maxLinks?: number;
}

const SUPPORTED_PLATFORMS = [
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'linkedin',
  'facebook',
  'website',
  'github'
];

export function SocialLinkManager({ 
  socialLinks = [], 
  onChange, 
  maxLinks = 3 
}: SocialLinkManagerProps) {
  const [newLink, setNewLink] = useState<{ platform: string; url: string }>({
    platform: '',
    url: ''
  });

  const handleAddLink = () => {
    if (!newLink.platform || !newLink.url || socialLinks.length >= maxLinks) return;

    const updatedLinks = [...socialLinks, {
      platform: newLink.platform,
      url: newLink.url,
      is_primary: socialLinks.length === 0 // First link becomes primary
    }];

    onChange(updatedLinks);
    setNewLink({ platform: '', url: '' });
  };

  const handleRemoveLink = (index: number) => {
    const updatedLinks = socialLinks.filter((_, i) => i !== index);
    
    // If we removed the primary link, make the first remaining link primary
    if (socialLinks[index]?.is_primary && updatedLinks.length > 0) {
      updatedLinks[0].is_primary = true;
    }

    onChange(updatedLinks);
  };

  const handleSetPrimary = (index: number) => {
    const updatedLinks = socialLinks.map((link, i) => ({
      ...link,
      is_primary: i === index
    }));

    onChange(updatedLinks);
  };

  const handleUpdateUrl = (index: number, url: string) => {
    const updatedLinks = socialLinks.map((link, i) => 
      i === index ? { ...link, url } : link
    );

    onChange(updatedLinks);
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          Social Links
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Add up to {maxLinks} social links. The primary link will be displayed in the feed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Links */}
        {socialLinks.map((link, index) => {
          const SocialIcon = getSocialIcon(link.platform);
          return (
            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
              <SocialIcon className="w-5 h-5 text-muted-foreground" />
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">
                    {link.platform}
                  </span>
                  {link.is_primary && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      Primary
                    </Badge>
                  )}
                </div>
                <Input
                  value={link.url}
                  onChange={(e) => handleUpdateUrl(index, e.target.value)}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                {!link.is_primary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetPrimary(index)}
                    title="Set as primary"
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLink(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Add New Link */}
        {socialLinks.length < maxLinks && (
          <div className="space-y-3 p-3 border-2 border-dashed rounded-lg">
            <div className="flex gap-3">
              <Select 
                value={newLink.platform} 
                onValueChange={(value) => setNewLink({ ...newLink, platform: value })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_PLATFORMS
                    .filter(platform => !socialLinks.some(link => link.platform === platform))
                    .map((platform) => {
                      const Icon = getSocialIcon(platform);
                      return (
                        <SelectItem key={platform} value={platform}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span className="capitalize">{platform}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>

              <Input
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                placeholder="https://..."
                className="flex-1"
              />

              <Button
                onClick={handleAddLink}
                disabled={!newLink.platform || !newLink.url || !isValidUrl(newLink.url)}
                size="sm"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {socialLinks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No social links added yet. Add your first link above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
