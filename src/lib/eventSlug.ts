/**
 * Event slug generation and beautification utilities
 */

/**
 * Generate a beautiful, SEO-friendly slug from event data
 */
export function generateEventSlug(eventData: {
  title: string;
  venue?: string | null;
  city?: string | null;
  startDate?: string | null;
  category?: string | null;
}): string {
  const { title, venue, city, startDate, category } = eventData;
  
  // Clean and format the title
  let slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Add venue if available and meaningful
  if (venue && venue.length > 0) {
    const venueSlug = venue
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    if (venueSlug.length > 0 && venueSlug !== slug) {
      slug += `-at-${venueSlug}`;
    }
  }

  // Add city if available
  if (city && city.length > 0) {
    const citySlug = city
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    if (citySlug.length > 0) {
      slug += `-in-${citySlug}`;
    }
  }

  // Add year if start date is available
  if (startDate) {
    try {
      const year = new Date(startDate).getFullYear();
      slug += `-${year}`;
    } catch (error) {
      // Ignore date parsing errors
    }
  }

  // Ensure slug is not too long (max 100 characters)
  if (slug.length > 100) {
    slug = slug.substring(0, 100).replace(/-[^-]*$/, ''); // Remove partial word at end
  }

  return slug;
}

/**
 * Beautify an existing slug by making it more readable
 */
export function beautifySlug(slug: string): string {
  return slug
    .split('-')
    .map((word, index) => {
      // Don't capitalize very short words unless they're important
      if (word.length <= 2 && index > 0) {
        const importantShortWords = ['at', 'in', 'on', 'of'];
        if (importantShortWords.includes(word)) {
          return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word.toLowerCase();
      }
      
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Generate a short, memorable slug for sharing
 */
export function generateShortSlug(eventData: {
  title: string;
  venue?: string | null;
  city?: string | null;
}): string {
  const { title, venue, city } = eventData;
  
  // Extract key words from title
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2); // Filter out short words

  // Take first 2-3 meaningful words
  let slug = words.slice(0, 3).join('-');
  
  // Add venue abbreviation if available
  if (venue && venue.length > 0) {
    const venueWords = venue.toLowerCase().split(/\s+/);
    const venueAbbr = venueWords
      .filter(word => word.length > 2)
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 3);
    
    if (venueAbbr.length > 0) {
      slug += `-${venueAbbr}`;
    }
  }

  // Add city abbreviation if available
  if (city && city.length > 0) {
    const cityAbbr = city.toLowerCase().replace(/[^\w]/g, '').substring(0, 3);
    if (cityAbbr.length > 0) {
      slug += `-${cityAbbr}`;
    }
  }

  return slug;
}

/**
 * Validate if a slug is well-formed
 */
export function isValidSlug(slug: string): boolean {
  // Check if slug follows good practices
  return (
    slug.length > 0 &&
    slug.length <= 100 &&
    /^[a-z0-9-]+$/.test(slug) && // Only lowercase letters, numbers, and hyphens
    !slug.startsWith('-') &&
    !slug.endsWith('-') &&
    !slug.includes('--') // No consecutive hyphens
  );
}

/**
 * Suggest improvements for a slug
 */
export function suggestSlugImprovements(slug: string): string[] {
  const suggestions: string[] = [];
  
  if (slug.length === 0) {
    suggestions.push('Slug cannot be empty');
  }
  
  if (slug.length > 100) {
    suggestions.push('Slug is too long (max 100 characters)');
  }
  
  if (!/^[a-z0-9-]+$/.test(slug)) {
    suggestions.push('Slug should only contain lowercase letters, numbers, and hyphens');
  }
  
  if (slug.startsWith('-') || slug.endsWith('-')) {
    suggestions.push('Slug should not start or end with hyphens');
  }
  
  if (slug.includes('--')) {
    suggestions.push('Slug should not contain consecutive hyphens');
  }
  
  if (slug.split('-').length < 2) {
    suggestions.push('Consider adding more descriptive words for better SEO');
  }
  
  return suggestions;
}
