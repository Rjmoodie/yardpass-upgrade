// Meta tags utility for rich previews (OG/Twitter cards)

export interface MetaTags {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

export function updateMetaTags(meta: MetaTags) {
  // Update page title
  document.title = meta.title;

  // Update or create meta tags
  updateMetaTag('property', 'og:title', meta.title);
  updateMetaTag('property', 'og:description', meta.description);
  updateMetaTag('property', 'og:type', meta.type || 'website');
  
  if (meta.image) {
    updateMetaTag('property', 'og:image', meta.image);
    updateMetaTag('name', 'twitter:image', meta.image);
  }
  
  if (meta.url) {
    updateMetaTag('property', 'og:url', meta.url);
  }

  // Twitter Card tags
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', meta.title);
  updateMetaTag('name', 'twitter:description', meta.description);
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

// Default meta tags for the app
export const defaultMeta: MetaTags = {
  title: 'YardPass - Discover Amazing Events',
  description: 'Join the hottest events in your area. Discover, attend, and share unforgettable experiences.',
  image: 'https://yardpass.com/og-image.jpg',
  url: 'https://yardpass.com',
};