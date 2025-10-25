/**
 * Event Categories - Single source of truth
 * Used across Search, Feed Filters, and Ad Targeting
 */

export const EVENT_CATEGORIES = [
  { value: 'Music', label: 'Music', icon: '🎵' },
  { value: 'Sports', label: 'Sports', icon: '⚽' },
  { value: 'Comedy', label: 'Comedy', icon: '🎭' },
  { value: 'Food', label: 'Food', icon: '🍕' },
  { value: 'Conference', label: 'Conference', icon: '💼' },
  { value: 'Art', label: 'Art', icon: '🎨' },
  { value: 'Nightlife', label: 'Nightlife', icon: '🌙' },
] as const;

export const CATEGORY_VALUES = EVENT_CATEGORIES.map(c => c.value);

export type EventCategory = typeof EVENT_CATEGORIES[number]['value'];

