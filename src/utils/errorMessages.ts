/**
 * User-friendly error message translations
 * Converts technical database/RLS errors into understandable messages
 */

export interface ErrorContext {
  action?: string;
  feature?: string;
  userRole?: string;
}

export function getUserFriendlyErrorMessage(error: any, context?: ErrorContext): string {
  const errorMessage = error?.message || error?.error || String(error);
  const errorCode = error?.code || error?.error?.code;

  // RLS Policy Violations
  if (errorCode === '42501' || errorMessage.includes('row-level security policy')) {
    return getRLSErrorMessage(context);
  }

  // Table/Relation doesn't exist
  if (errorCode === '42P01' || errorMessage.includes('does not exist')) {
    return getMissingTableErrorMessage(context);
  }

  // Permission denied
  if (errorCode === '42501' || errorMessage.includes('permission denied')) {
    return getPermissionErrorMessage(context);
  }

  // Foreign key violations
  if (errorCode === '23503' || errorMessage.includes('foreign key')) {
    return getForeignKeyErrorMessage(context);
  }

  // Unique constraint violations
  if (errorCode === '23505' || errorMessage.includes('duplicate key')) {
    return getUniqueConstraintErrorMessage(context);
  }

  // Network/Connection errors
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    return 'Connection issue. Please check your internet and try again.';
  }

  // Authentication errors
  if (errorMessage.includes('JWT') || errorMessage.includes('token') || errorMessage.includes('unauthorized')) {
    return 'Please sign in to continue.';
  }

  // Default fallback
  return getGenericErrorMessage(context);
}

function getRLSErrorMessage(context?: ErrorContext): string {
  const { action, feature } = context || {};

  if (feature === 'messaging' || action === 'start conversation') {
    return 'Unable to start conversation. Please try again or contact support if the issue persists.';
  }

  if (feature === 'follow' || action === 'follow') {
    return 'Unable to follow this user. Please try again later.';
  }

  if (feature === 'notification') {
    return 'Unable to send notification. Please try again.';
  }

  if (feature === 'post' || action === 'create post') {
    return 'Unable to create post. Please try again.';
  }

  if (feature === 'event' || action === 'create event') {
    return 'Unable to create event. Please try again.';
  }

  return 'Access denied. Please try again or contact support if the issue persists.';
}

function getMissingTableErrorMessage(context?: ErrorContext): string {
  const { feature } = context || {};

  if (feature === 'messaging') {
    return 'Messaging system is temporarily unavailable. Please try again later.';
  }

  if (feature === 'follow') {
    return 'Network features are temporarily unavailable. Please try again later.';
  }

  return 'This feature is temporarily unavailable. Please try again later.';
}

function getPermissionErrorMessage(context?: ErrorContext): string {
  const { action, userRole } = context || {};

  if (action === 'create conversation' && userRole === 'attendee') {
    return 'You need to be an organizer to start conversations.';
  }

  if (action === 'create event' && userRole === 'attendee') {
    return 'You need to be an organizer to create events.';
  }

  return 'You don\'t have permission to perform this action.';
}

function getForeignKeyErrorMessage(context?: ErrorContext): string {
  const { action } = context || {};

  if (action === 'start conversation') {
    return 'Unable to start conversation. The user may not exist or may have blocked you.';
  }

  if (action === 'follow') {
    return 'Unable to follow. The user may not exist.';
  }

  return 'Unable to complete this action. Please try again.';
}

function getUniqueConstraintErrorMessage(context?: ErrorContext): string {
  const { action } = context || {};

  if (action === 'follow') {
    return 'You are already following this user.';
  }

  if (action === 'create conversation') {
    return 'A conversation with this user already exists.';
  }

  return 'This action has already been completed.';
}

function getGenericErrorMessage(context?: ErrorContext): string {
  const { action, feature } = context || {};

  if (action === 'start conversation') {
    return 'Unable to start conversation. Please try again later.';
  }

  if (action === 'follow') {
    return 'Unable to follow. Please try again later.';
  }

  if (feature === 'messaging') {
    return 'Messaging is temporarily unavailable. Please try again later.';
  }

  return 'Something went wrong. Please try again later.';
}

/**
 * Enhanced error handler that provides context-aware error messages
 */
export function handleUserFriendlyError(error: any, context?: ErrorContext): {
  message: string;
  shouldRetry: boolean;
  action?: string;
} {
  const friendlyMessage = getUserFriendlyErrorMessage(error, context);
  
  // Determine if the user should retry
  const shouldRetry = !(
    error?.code === '42501' || // Permission denied
    error?.code === '23505' || // Unique constraint
    error?.message?.includes('does not exist') // Missing table/relation
  );

  return {
    message: friendlyMessage,
    shouldRetry,
    action: context?.action
  };
}
