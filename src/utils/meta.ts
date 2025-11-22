// Meta tags utility for rich previews (OG/Twitter cards)
import type { OgPayload } from '@/types/og';

// Re-export for convenience (backwards compatibility)
export type { OgPayload as MetaTags };

/**
 * Update meta tags in the document head
 * 
 * Uses the shared OgPayload type to ensure consistency with server-side OG rendering.
 * 
 * @param meta - OG payload with required title, description, image, and url
 */
export function updateMetaTags(meta: OgPayload) {
  // Validate required fields
  if (!meta.title || !meta.description || !meta.image || !meta.url) {
    console.warn('[updateMetaTags] Missing required fields:', { 
      hasTitle: !!meta.title, 
      hasDescription: !!meta.description, 
      hasImage: !!meta.image, 
      hasUrl: !!meta.url 
    });
    return;
  }
  // Update page title
  document.title = meta.title;

  // Basic Open Graph tags
  updateMetaTag('property', 'og:title', meta.title);
  updateMetaTag('property', 'og:description', meta.description);
  updateMetaTag('property', 'og:type', meta.type || 'website');
  updateMetaTag('property', 'og:site_name', meta.siteName || 'Liventix');
  updateMetaTag('property', 'og:locale', meta.locale || 'en_US');
  
  // Image tags (always set since it's required)
  updateMetaTag('property', 'og:image', meta.image);
  updateMetaTag('name', 'twitter:image', meta.image);
  
  if (meta.imageWidth) {
    updateMetaTag('property', 'og:image:width', meta.imageWidth.toString());
  }
  if (meta.imageHeight) {
    updateMetaTag('property', 'og:image:height', meta.imageHeight.toString());
  }
  updateMetaTag('property', 'og:image:type', meta.imageType || 'image/jpeg');
  
  // URL (always set since it's required)
  updateMetaTag('property', 'og:url', meta.url);
  
  // Canonical URL for SEO
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', meta.url);

  // Event-specific tags (if type is article, treat as event)
  if (meta.type === 'article' || meta.eventStartTime) {
    if (meta.eventStartTime) {
      updateMetaTag('property', 'article:published_time', meta.eventStartTime);
    }
    if (meta.eventEndTime) {
      updateMetaTag('property', 'article:modified_time', meta.eventEndTime);
    }
    if (meta.eventLocation) {
      updateMetaTag('property', 'og:locale:alternate', meta.eventLocation);
    }
  }

  // Article-specific tags
  if (meta.type === 'article') {
    if (meta.author) {
      updateMetaTag('property', 'article:author', meta.author);
    }
    if (meta.publishedTime) {
      updateMetaTag('property', 'article:published_time', meta.publishedTime);
    }
    if (meta.modifiedTime) {
      updateMetaTag('property', 'article:modified_time', meta.modifiedTime);
    }
  }

  // Twitter Card tags
  updateMetaTag('name', 'twitter:card', meta.twitterCard || 'summary_large_image');
  updateMetaTag('name', 'twitter:title', meta.title);
  updateMetaTag('name', 'twitter:description', meta.description);
  
  if (meta.twitterSite) {
    updateMetaTag('name', 'twitter:site', meta.twitterSite);
  }
  if (meta.twitterCreator) {
    updateMetaTag('name', 'twitter:creator', meta.twitterCreator);
  }
}

function updateMetaTag(attr: 'name' | 'property', value: string, content: string) {
  let tag = document.querySelector(`meta[${attr}="${value}"]`);
  
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, value);
    document.head.appendChild(tag);
  }
  
  tag.setAttribute('content', content);
}

// Re-export default payload from og.ts
export { DEFAULT_OG_PAYLOAD as defaultMeta } from '@/types/og';