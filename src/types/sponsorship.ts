/**
 * Sponsorship Type Definitions
 * 
 * Centralized TypeScript interfaces for sponsorship-related data structures.
 */

import { SponsorshipOrderStatus } from '@/constants/sponsorship';

/**
 * Base sponsorship package record from database
 */
export interface SponsorshipPackageRecord {
  id: string;
  event_id: string;
  title?: string | null;
  tier?: string | null;
  price_cents: number;
  inventory?: number | null;
  sold?: number | null;
  visibility?: string | null;
  is_active?: boolean | null;
  benefits: Record<string, any>; // Always an object, never null (defaults to {})
  created_at?: string;
}

/**
 * Sponsorship order record from database with joined data
 */
export interface SponsorshipOrderRecord {
  id: string;
  event_id: string;
  package_id: string;
  sponsor_id: string;
  amount_cents: number;
  status: SponsorshipOrderStatus | string;
  created_at: string;
  updated_at?: string;
  // Joined fields
  sponsor_name?: string | null;
  sponsor_logo?: string | null;
  package_tier?: string | null;
  package_title?: string | null;
}

/**
 * Sponsor profile record
 */
export interface SponsorRecord {
  id: string;
  name: string;
  logo_url?: string | null;
  website?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Aggregated sponsorship summary for an event
 */
export interface EventSponsorshipSummary {
  packages: number;
  totalAvailable: number;
  sold: number;
  revenue: number;
  pending: number;
  sponsors: number;
}

/**
 * Overall sponsorship statistics across all events
 */
export interface SponsorshipStats {
  totalRevenue: number;
  activeSponsors: number;
  totalPackages: number;
  pendingRequests: number;
  soldOutPackages: number;
}

/**
 * Form data for creating/editing a sponsorship package
 */
export interface SponsorshipPackageFormData {
  tier: string;
  title?: string;
  price_cents: number;
  inventory: number;
  benefits: Record<string, any>;
  visibility: 'public' | 'invite_only';
  is_active?: boolean;
}

/**
 * Sponsorship package with computed fields
 */
export interface EnhancedSponsorshipPackage extends SponsorshipPackageRecord {
  soldCount: number;
  availableCount: number;
  utilizationPercent: number;
  revenueTotal: number;
}

/**
 * Event row for sponsorship overview table
 */
export interface EventSponsorshipRow {
  id: string;
  title: string;
  startDate: Date | null;
  summary: EventSponsorshipSummary;
}

/**
 * Props for sponsorship components
 */
export interface EventSponsorshipManagementProps {
  eventId: string;
  onDataChange?: () => void;
}

export interface PackageEditorProps {
  eventId: string;
  onCreated?: () => void;
}

