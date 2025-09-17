import { 
  Instagram, 
  Twitter, 
  Youtube, 
  Linkedin, 
  Facebook, 
  Github,
  Globe,
  Music
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export const SOCIAL_PLATFORMS = {
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    baseUrl: 'https://instagram.com/',
    color: 'text-pink-500'
  },
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    baseUrl: 'https://twitter.com/',
    color: 'text-blue-400'
  },
  tiktok: {
    name: 'TikTok',
    icon: Music, // Using Music as TikTok icon
    baseUrl: 'https://tiktok.com/',
    color: 'text-pink-600'
  },
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    baseUrl: 'https://youtube.com/',
    color: 'text-red-500'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    baseUrl: 'https://linkedin.com/',
    color: 'text-blue-600'
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    baseUrl: 'https://facebook.com/',
    color: 'text-blue-500'
  },
  github: {
    name: 'GitHub',
    icon: Github,
    baseUrl: 'https://github.com/',
    color: 'text-gray-700 dark:text-gray-300'
  },
  website: {
    name: 'Website',
    icon: Globe,
    baseUrl: '',
    color: 'text-gray-600'
  }
};

export function getSocialIcon(platform: string): LucideIcon {
  return SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS]?.icon || Globe;
}

export function getSocialColor(platform: string): string {
  return SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS]?.color || 'text-gray-600';
}

export function getSocialName(platform: string): string {
  return SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS]?.name || platform;
}

export function validateSocialUrl(platform: string, url: string): boolean {
  try {
    const urlObj = new URL(url);
    const platformData = SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS];
    
    if (!platformData) return false;
    
    // For website, allow any valid URL
    if (platform === 'website') return true;
    
    // For specific platforms, check if the domain matches
    const expectedDomain = new URL(platformData.baseUrl).hostname;
    return urlObj.hostname === expectedDomain || urlObj.hostname === `www.${expectedDomain}`;
  } catch {
    return false;
  }
}