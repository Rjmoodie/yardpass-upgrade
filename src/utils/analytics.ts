/**
 * Analytics Tracking Utility
 * 
 * Centralized analytics tracking for Google Analytics and other platforms
 * Tracks user journeys, conversions, and key interactions
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      eventName: string,
      params?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}

/**
 * Check if analytics is available
 */
function isAnalyticsAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Track a generic event
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, any>
): void {
  if (isAnalyticsAvailable()) {
    window.gtag!('event', eventName, params);
  }
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', eventName, params);
  }
}

/**
 * Track page view
 */
export function trackPageView(
  path: string,
  title?: string
): void {
  if (isAnalyticsAvailable()) {
    window.gtag!('config', 'GA_MEASUREMENT_ID', {
      page_path: path,
      page_title: title,
    });
  }
}

// =====================================
// Sponsorship Journey Events
// =====================================

/**
 * Track when user browses the marketplace
 */
export function trackMarketplaceBrowse(params?: {
  filters?: Record<string, any>;
  resultsCount?: number;
  searchQuery?: string;
  filtersApplied?: boolean;
  source?: 'sponsorship_page' | 'sponsor_dashboard' | 'organizer_dashboard';
  selectedCategory?: string;
  priceRange?: { min?: number; max?: number };
  location?: string;
}): void {
  trackEvent('marketplace_browse', {
    ...params,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track when user views a package
 */
export function trackPackageView(params: {
  packageId: string;
  eventTitle: string;
  priceCents: number;
  source?: 'marketplace' | 'search' | 'recommendation';
}): void {
  trackEvent('package_view', {
    ...params,
    price_usd: params.priceCents / 100,
  });
}

/**
 * Track when user previews a package
 */
export function trackPackagePreview(params: {
  packageId: string;
  eventTitle: string;
}): void {
  trackEvent('package_preview', params);
}

/**
 * Track package purchase initiation
 */
export function trackPackagePurchaseStart(params: {
  packageId: string;
  eventTitle: string;
  priceCents: number;
  sponsorId: string;
}): void {
  trackEvent('begin_checkout', {
    ...params,
    currency: 'USD',
    value: params.priceCents / 100,
    items: [{
      item_id: params.packageId,
      item_name: params.eventTitle,
      price: params.priceCents / 100,
    }],
  });
}

/**
 * Track successful package purchase
 */
export function trackPackagePurchaseComplete(params: {
  packageId: string;
  eventTitle: string;
  priceCents: number;
  sponsorId: string;
  orderId: string;
}): void {
  trackEvent('purchase', {
    transaction_id: params.orderId,
    value: params.priceCents / 100,
    currency: 'USD',
    items: [{
      item_id: params.packageId,
      item_name: params.eventTitle,
      price: params.priceCents / 100,
    }],
    sponsor_id: params.sponsorId,
  });
}

// =====================================
// User Journey Events
// =====================================

/**
 * Track when user creates a sponsor account
 */
export function trackSponsorAccountCreated(params: {
  sponsorId: string;
  sponsorName: string;
  industry: string;
}): void {
  trackEvent('sponsor_account_created', params);
}

/**
 * Track when user enables sponsor mode
 */
export function trackSponsorModeEnabled(params: {
  userId: string;
}): void {
  trackEvent('sponsor_mode_enabled', params);
}

/**
 * Track CTA clicks
 */
export function trackCTAClick(params: {
  ctaType: 'become_sponsor' | 'manage_events' | 'get_started' | 'learn_more';
  source: 'hero' | 'marketplace' | 'how_it_works' | 'navigation';
  destination: string;
}): void {
  trackEvent('cta_click', params);
}

/**
 * Track conversion from browse to sign up
 */
export function trackBrowseToSignup(params: {
  timeSpentSeconds: number;
  packagesViewed: number;
  filtersUsed: string[];
}): void {
  trackEvent('browse_to_signup', params);
}

/**
 * Track when organizer creates a sponsorship package
 */
export function trackPackageCreated(params: {
  eventId: string;
  packageId: string;
  priceCents: number;
  hasAnalyticsShowcase: boolean;
  hasReferenceEvent: boolean;
}): void {
  trackEvent('organizer_package_created', {
    ...params,
    price_usd: params.priceCents / 100,
  });
}

/**
 * Track when organizer accepts/rejects sponsor request
 */
export function trackSponsorRequestAction(params: {
  action: 'accepted' | 'rejected';
  orderId: string;
  packageId: string;
  eventId: string;
}): void {
  trackEvent('sponsor_request_action', params);
}

// =====================================
// Engagement Events
// =====================================

/**
 * Track search usage
 */
export function trackSearch(params: {
  query: string;
  resultsCount: number;
  filters?: Record<string, any>;
}): void {
  trackEvent('search', params);
}

/**
 * Track filter usage
 */
export function trackFilterApplied(params: {
  filterType: string;
  filterValue: string;
  resultsCount: number;
}): void {
  trackEvent('filter_applied', params);
}

/**
 * Track when user switches sponsor accounts
 */
export function trackSponsorAccountSwitch(params: {
  fromSponsorId: string | null;
  toSponsorId: string;
}): void {
  trackEvent('sponsor_account_switch', params);
}

// =====================================
// Error & Support Events
// =====================================

/**
 * Track errors for monitoring
 */
export function trackError(params: {
  errorType: string;
  errorMessage: string;
  component?: string;
  userId?: string;
}): void {
  trackEvent('error', params);
}

/**
 * Track when user encounters issue and needs help
 */
export function trackSupportRequest(params: {
  requestType: string;
  context: string;
}): void {
  trackEvent('support_request', params);
}

// =====================================
// Session Management
// =====================================

interface BrowseSession {
  startTime: number;
  packagesViewed: string[];
  filtersUsed: Set<string>;
}

let currentBrowseSession: BrowseSession | null = null;

/**
 * Start tracking a browse session
 */
export function startBrowseSession(): void {
  currentBrowseSession = {
    startTime: Date.now(),
    packagesViewed: [],
    filtersUsed: new Set(),
  };
}

/**
 * Add package view to current session
 */
export function addPackageToSession(packageId: string): void {
  if (currentBrowseSession && !currentBrowseSession.packagesViewed.includes(packageId)) {
    currentBrowseSession.packagesViewed.push(packageId);
  }
}

/**
 * Add filter to current session
 */
export function addFilterToSession(filterName: string): void {
  if (currentBrowseSession) {
    currentBrowseSession.filtersUsed.add(filterName);
  }
}

/**
 * End browse session and track conversion if user signs up
 */
export function endBrowseSessionWithSignup(): void {
  if (currentBrowseSession) {
    const timeSpentSeconds = Math.floor((Date.now() - currentBrowseSession.startTime) / 1000);
    trackBrowseToSignup({
      timeSpentSeconds,
      packagesViewed: currentBrowseSession.packagesViewed.length,
      filtersUsed: Array.from(currentBrowseSession.filtersUsed),
    });
    currentBrowseSession = null;
  }
}

/**
 * Clear browse session without tracking (e.g., user navigates away)
 */
export function clearBrowseSession(): void {
  currentBrowseSession = null;
}

