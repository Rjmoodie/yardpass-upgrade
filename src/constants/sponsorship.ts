/**
 * Sponsorship Status Constants
 * 
 * Centralized definitions for sponsorship order statuses used throughout the application.
 */

/**
 * Statuses that indicate a committed/confirmed sponsorship deal
 * These contribute to revenue calculations and sponsor counts
 */
export const SPONSORSHIP_COMMITTED_STATUSES = new Set([
  'accepted',
  'active',
  'approved',
  'completed',
  'confirmed',
  'escrow',
  'live',
  'paid',
] as const);

/**
 * Statuses that indicate a sponsorship request awaiting action
 */
export const SPONSORSHIP_PENDING_STATUSES = new Set([
  'pending',
  'requires_payment',
  'review',
] as const);

/**
 * All valid sponsorship order statuses
 */
export type SponsorshipOrderStatus =
  | 'pending'
  | 'accepted'
  | 'active'
  | 'approved'
  | 'completed'
  | 'confirmed'
  | 'escrow'
  | 'live'
  | 'paid'
  | 'requires_payment'
  | 'review'
  | 'cancelled'
  | 'refunded'
  | 'rejected';

/**
 * Check if a status represents a committed sponsorship
 */
export function isCommittedStatus(status: string): boolean {
  return SPONSORSHIP_COMMITTED_STATUSES.has(status as any);
}

/**
 * Check if a status represents a pending request
 */
export function isPendingStatus(status: string): boolean {
  return SPONSORSHIP_PENDING_STATUSES.has(status as any);
}

/**
 * Get display-friendly status text
 */
export function getStatusLabel(status: SponsorshipOrderStatus): string {
  const labels: Record<SponsorshipOrderStatus, string> = {
    pending: 'Pending Review',
    accepted: 'Accepted',
    active: 'Active',
    approved: 'Approved',
    completed: 'Completed',
    confirmed: 'Confirmed',
    escrow: 'In Escrow',
    live: 'Live',
    paid: 'Paid',
    requires_payment: 'Payment Required',
    review: 'Under Review',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    rejected: 'Rejected',
  };
  return labels[status] || status;
}

/**
 * Get CSS classes for status badges
 */
export function getStatusColorClasses(status: SponsorshipOrderStatus): string {
  const colors: Partial<Record<SponsorshipOrderStatus, string>> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    live: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-500',
    refunded: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
}

