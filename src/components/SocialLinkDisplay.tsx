import React from 'react';
import { getSocialIcon, getSocialColor, getSocialName } from '@/utils/socialIcons';
import { ExternalLink } from 'lucide-react';
import { SocialLink } from './SocialLinkManager';

interface SocialLinkDisplayProps {
  socialLinks: SocialLink[];
  showPrimaryOnly?: boolean;
  className?: string;
}

export function SocialLinkDisplay({ 
  socialLinks = [], 
  showPrimaryOnly = false, 
  className = "" 
}: SocialLinkDisplayProps) {
  const linksToShow = showPrimaryOnly 
    ? socialLinks.filter(link => link.is_primary)
    : socialLinks;

  if (linksToShow.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {linksToShow.map((link, index) => {
        const SocialIcon = getSocialIcon(link.platform);
        const colorClass = getSocialColor(link.platform);
        
        return (
          <a
            key={index}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 text-sm ${colorClass} hover:opacity-70 transition-opacity`}
            title={`${getSocialName(link.platform)}: ${link.url}`}
          >
            <SocialIcon className="w-4 h-4" />
            {!showPrimaryOnly && (
              <span className="hidden sm:inline">
                {getSocialName(link.platform)}
              </span>
            )}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        );
      })}
    </div>
  );
}