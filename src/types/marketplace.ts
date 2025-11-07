/**
 * Marketplace Analytics and Stats Types
 * 
 * Shared types for tracking marketplace behavior and user interactions
 */

export interface MarketplaceBrowseStats {
  resultsCount: number;
  searchQuery?: string;
  filtersApplied?: boolean;
  selectedCategory?: string;
  priceRange?: { min?: number; max?: number };
  location?: string;
  source?: 'sponsorship_page' | 'sponsor_dashboard' | 'organizer_dashboard';
}

export interface PackageInteractionStats {
  packageId: string;
  eventTitle: string;
  action: 'view' | 'preview' | 'click' | 'buy_initiated';
  source?: string;
}

export interface MarketplaceFilters {
  search?: string;
  city?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
}

