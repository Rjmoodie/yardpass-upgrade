// Complete TypeScript types for enterprise sponsorship system
// Extends existing types with all Phase 2 & 3 features

export type UUID = string;

// === Enhanced Core Types ===

export interface SponsorComplete extends Sponsor {
  // Phase 2 additions
  objectives_embedding?: number[]; // Vector embedding for semantic search
  verification_status: 'none' | 'pending' | 'verified' | 'revoked';
  public_visibility: 'hidden' | 'limited' | 'full';
  case_studies?: Record<string, unknown>;
  preferred_formats?: string[];
}

export interface SponsorPublicProfile {
  sponsor_id: UUID;
  slug: string;
  headline?: string;
  about?: string;
  brand_values: Record<string, unknown>;
  badges: string[];
  is_verified: boolean;
  social_links: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

export interface SponsorMember {
  sponsor_id: UUID;
  user_id: UUID;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  created_at: string;
}

// === Package System Types ===

export interface PackageTemplate {
  id: UUID;
  org_id: UUID;
  title: string;
  description?: string;
  default_price_cents: number;
  default_benefits: Record<string, unknown>;
  visibility: 'private' | 'org' | 'public';
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PackageVariant {
  id: UUID;
  package_id: UUID;
  label: string;
  price_cents: number;
  benefits: Record<string, unknown>;
  inventory: number;
  stat_snapshot_id?: UUID;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// === Proposal & Negotiation Types ===

export type ProposalStatus = 'draft' | 'sent' | 'counter' | 'accepted' | 'rejected' | 'expired';

export interface ProposalThread {
  id: UUID;
  event_id: UUID;
  sponsor_id: UUID;
  status: ProposalStatus;
  created_by: UUID;
  created_at: string;
  updated_at: string;
}

export interface ProposalMessage {
  id: UUID;
  thread_id: UUID;
  sender_type: 'organizer' | 'sponsor';
  sender_user_id: UUID;
  body?: string;
  offer: Record<string, unknown>;
  attachments?: Record<string, unknown>;
  created_at: string;
}

// === Deliverables & SLA Types ===

export type DeliverableStatus = 'pending' | 'submitted' | 'needs_changes' | 'approved' | 'waived';

export interface Deliverable {
  id: UUID;
  event_id: UUID;
  sponsor_id: UUID;
  type: string;
  spec: Record<string, unknown>;
  due_at?: string;
  status: DeliverableStatus;
  evidence_required: boolean;
  created_at: string;
  updated_at: string;
  order_id?: UUID;
  package_id?: UUID;
  package_variant_id?: UUID;
}

export interface DeliverableProof {
  id: UUID;
  deliverable_id: UUID;
  asset_url: string;
  metrics: Record<string, unknown>;
  submitted_by?: UUID;
  submitted_at: string;
  approved_at?: string;
  rejected_reason?: string;
}

export interface SponsorshipSLA {
  id: UUID;
  event_id: UUID;
  sponsor_id: UUID;
  deliverable_id?: UUID;
  metric: string;
  target: number;
  breach_policy: Record<string, unknown>;
  created_at: string;
}

// === Payment & Payout Types ===

export type SponsorshipStatus = 'pending' | 'completed' | 'cancelled';
export type EscrowState = 'pending' | 'funded' | 'locked' | 'released' | 'refunded';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface SponsorshipOrderComplete extends SponsorshipOrder {
  // Enhanced fields
  created_by_user_id?: UUID;
  last_modified_by?: UUID;
  version_number: number;
  review_score?: number;
  organizer_stripe_account_id?: string;
  payout_status: PayoutStatus;
  payout_attempts: number;
  last_payout_attempt_at?: string;
  payout_failure_reason?: string;
  contract_url?: string;
  escrow_state?: EscrowState;
  cancellation_policy?: Record<string, unknown>;
  invoice_id?: UUID;
}

export interface SponsorshipPayout {
  id: UUID;
  order_id: UUID;
  organizer_id: UUID;
  amount_cents: number;
  application_fee_cents: number;
  stripe_transfer_id?: string;
  stripe_payout_id?: string;
  status: PayoutStatus;
  failure_reason?: string;
  created_at: string;
  processed_at?: string;
}

export interface PayoutConfiguration {
  id: UUID;
  organization_id: UUID;
  stripe_connect_account_id: string;
  platform_fee_percentage: number;
  minimum_payout_amount_cents: number;
  payout_schedule: 'manual' | 'daily' | 'weekly' | 'monthly';
  auto_payout_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayoutQueue {
  id: UUID;
  order_id: UUID;
  priority: number;
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
  status: PayoutStatus;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

// === Match Features & Feedback Types ===

export interface MatchFeature {
  id: UUID;
  event_id: UUID;
  sponsor_id: UUID;
  features: Record<string, unknown>;
  version: number;
  computed_at: string;
}

export type MatchFeedbackLabel = 'good_fit' | 'bad_fit' | 'later';

export interface MatchFeedback {
  id: UUID;
  event_id: UUID;
  sponsor_id: UUID;
  user_id: UUID;
  label: MatchFeedbackLabel;
  reason_codes: string[];
  notes?: string;
  created_at: string;
}

// === Audience Consent Types ===

export type ConsentScope = 'aggregated' | 'cohort' | 'pseudonymous';

export interface AudienceConsent {
  id: UUID;
  event_id: UUID;
  segment_key: string;
  scope: ConsentScope;
  consent_basis: string;
  expires_at?: string;
  created_at: string;
}

// === Enhanced View Types ===

export interface EventQualityScore {
  event_id: UUID;
  final_quality_score: number;
  quality_tier: 'low' | 'medium' | 'high' | 'premium';
  engagement_rate: number;
  volume_score: number;
  social_proof_score: number;
  normalized_sentiment_score: number;
  computed_at: string;
}

export interface SponsorshipPackageCardComplete extends SponsorshipPackageCard {
  // Quality score data
  final_quality_score?: number;
  quality_tier?: string;
  engagement_rate?: number;
  volume_score?: number;
  social_proof_score?: number;
  normalized_sentiment_score?: number;
}

// === Semantic Search Types ===

export interface SemanticShortlist {
  event_id?: UUID;
  sponsor_id?: UUID;
  similarity_score: number;
  embedding_distance: number;
  matched_at: string;
}

// === API Request/Response Types ===

export interface CreateSponsorRequest {
  name: string;
  logo_url?: string;
  website_url?: string;
  contact_email?: string;
  industry?: string;
  company_size?: string;
  brand_values?: Record<string, unknown>;
  preferred_visibility_options?: Record<string, unknown>;
}

export interface UpdateSponsorProfileRequest {
  industry?: string;
  company_size?: string;
  annual_budget_cents?: number;
  brand_objectives?: Record<string, unknown>;
  target_audience?: Record<string, unknown>;
  preferred_categories?: string[];
  regions?: string[];
  activation_preferences?: Record<string, unknown>;
  case_studies?: Record<string, unknown>;
  preferred_formats?: string[];
}

export interface CreatePackageRequest {
  event_id: UUID;
  tier: string;
  title?: string;
  description?: string;
  price_cents: number;
  currency?: string;
  inventory?: number;
  benefits?: Record<string, unknown>;
  visibility?: string;
  expected_reach?: number;
  package_type?: string;
  template_id?: UUID;
}

export interface CreateProposalRequest {
  event_id: UUID;
  sponsor_id: UUID;
  message?: string;
  offer: Record<string, unknown>;
  attachments?: Record<string, unknown>;
}

export interface UpdateMatchStatusRequest {
  status: SponsorshipMatchStatus;
  notes?: string;
  declined_reason?: string;
}

export interface CreateDeliverableRequest {
  event_id: UUID;
  sponsor_id: UUID;
  type: string;
  spec: Record<string, unknown>;
  due_at?: string;
  evidence_required?: boolean;
  order_id?: UUID;
  package_id?: UUID;
  package_variant_id?: UUID;
}

export interface SubmitDeliverableProofRequest {
  deliverable_id: UUID;
  asset_url: string;
  metrics: Record<string, unknown>;
}

export interface CreateDeliverableRequest {
  event_id: UUID;
  sponsor_id: UUID;
  type: string;
  spec: Record<string, unknown>;
  due_at?: string;
  evidence_required?: boolean;
  order_id?: UUID;
  package_id?: UUID;
  package_variant_id?: UUID;
}

// === Analytics & Reporting Types ===

export interface SponsorshipAnalytics {
  total_matches: number;
  accepted_matches: number;
  conversion_rate: number;
  avg_match_score: number;
  total_revenue_cents: number;
  avg_deal_size_cents: number;
  top_categories: Array<{ category: string; count: number }>;
  top_regions: Array<{ region: string; count: number }>;
  performance_trends: Array<{
    period: string;
    matches: number;
    revenue: number;
  }>;
}

export interface EventSponsorshipMetrics {
  event_id: UUID;
  total_packages: number;
  active_packages: number;
  total_revenue_cents: number;
  avg_package_price_cents: number;
  conversion_rate: number;
  top_sponsors: Array<{
    sponsor_id: UUID;
    sponsor_name: string;
    total_spent_cents: number;
  }>;
}

// === Real-time Types ===

export interface SponsorshipNotification {
  id: UUID;
  user_id: UUID;
  type: 'match_suggested' | 'proposal_received' | 'deliverable_due' | 'payout_completed' | 'match_accepted';
  title: string;
  message: string;
  data: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface RealTimeMatchUpdate {
  event_id: UUID;
  sponsor_id: UUID;
  score: number;
  status: SponsorshipMatchStatus;
  updated_at: string;
}

// === UI Component Props ===

export interface SponsorshipMarketplaceProps {
  filters?: {
    category?: string;
    priceRange?: [number, number];
    location?: string;
    qualityTier?: string;
  };
  sortBy?: 'price' | 'quality' | 'relevance' | 'date';
  onPackageSelect?: (packageId: UUID) => void;
}

export interface SponsorDashboardProps {
  sponsorId: UUID;
  onNavigateToEvent?: (eventId: UUID) => void;
  onNavigateToMatch?: (matchId: UUID) => void;
}

export interface EventSponsorshipManagementProps {
  eventId: UUID;
  onPackageCreate?: (package: CreatePackageRequest) => void;
  onPackageUpdate?: (packageId: UUID, updates: Partial<CreatePackageRequest>) => void;
  onMatchAction?: (matchId: UUID, action: string) => void;
}

export interface ProposalNegotiationProps {
  threadId: UUID;
  onMessageSend?: (message: string, offer: Record<string, unknown>) => void;
  onAccept?: () => void;
  onReject?: (reason: string) => void;
}

export interface DeliverableManagementProps {
  deliverables: Deliverable[];
  onProofSubmit?: (deliverableId: UUID, proof: SubmitDeliverableProofRequest) => void;
  onStatusUpdate?: (deliverableId: UUID, status: DeliverableStatus) => void;
}

// === API Response Types ===

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SponsorshipSearchResponse {
  packages: SponsorshipPackageCardComplete[];
  events: EventRecommendation[];
  sponsors: SponsorRecommendation[];
  total: number;
  facets: {
    categories: Array<{ name: string; count: number }>;
    priceRanges: Array<{ range: string; count: number }>;
    locations: Array<{ name: string; count: number }>;
  };
}

// === Webhook Types ===

export interface SponsorshipWebhookPayload {
  event: string;
  data: {
    id: UUID;
    type: 'match' | 'proposal' | 'order' | 'deliverable' | 'payout';
    changes: Record<string, unknown>;
  };
  timestamp: string;
}

// === Error Types ===

export interface SponsorshipError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
}

export interface ValidationError extends SponsorshipError {
  code: 'VALIDATION_ERROR';
  field: string;
  value: unknown;
  constraint: string;
}

export interface BusinessLogicError extends SponsorshipError {
  code: 'BUSINESS_LOGIC_ERROR';
  context: string;
}

export interface ExternalServiceError extends SponsorshipError {
  code: 'EXTERNAL_SERVICE_ERROR';
  service: string;
  originalError?: string;
}
