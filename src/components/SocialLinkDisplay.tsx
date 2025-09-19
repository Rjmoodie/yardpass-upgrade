import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getSocialIcon, getSocialColor, getSocialName } from '@/utils/socialIcons';
import { ExternalLink } from 'lucide-react';

interface SocialLink {
  platform: string;
  url: string;
  is_primary: boolean;
}

interface SocialLinkDisplayProps {
  socialLinks: SocialLink[];
  showLabels?: boolean;
  showPrimaryOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SocialLinkDisplay({ 
  socialLinks, 
  showLabels = false,
  showPrimaryOnly = false,
  size = 'md',
  className = '' 
}: SocialLinkDisplayProps) {
  if (!socialLinks || socialLinks.length === 0) {
    return null;
  }

  const filteredLinks = showPrimaryOnly 
    ? socialLinks.filter(link => link.is_primary)
    : socialLinks;

  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  const containerSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {filteredLinks.map((link, index) => {
        const Icon = getSocialIcon(link.platform);
        const colorClass = getSocialColor(link.platform);
        const platformName = getSocialName(link.platform);

        return (
          <div key={index} className="flex items-center gap-1">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${containerSize} flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors group`}
              title={`Visit ${platformName}`}
            >
              <Icon className={`${iconSize} ${colorClass} group-hover:scale-110 transition-transform`} />
            </a>
            {showLabels && (
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">{platformName}</span>
                {link.is_primary && (
                  <Badge variant="secondary" className="text-xs">
                    Primary
                  </Badge>
                )}
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}