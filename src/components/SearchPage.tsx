// SearchPage with consolidated filter modal
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Search,
  X,
  SlidersHorizontal,
  Calendar as CalendarIcon,
  Sparkles,
  MapPin,
  LocateFixed,
  History,
} from 'lucide-react';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useInteractionTracking } from '@/hooks/useInteractionTracking';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, isSameDay, nextSaturday, nextSunday } from 'date-fns';
import { cn } from '@/lib/utils';
import { FilterChip } from './search/FilterChip';
import { EventCard } from './search/EventCard';
import { SkeletonGrid, EmptyState } from './search/SearchPageComponents';
import { useSmartSearch } from '@/hooks/useSmartSearch';
import { useCampaignBoosts } from '@/hooks/useCampaignBoosts';
import { canServeCampaign, logAdClick, logAdImpression } from '@/lib/adTracking';
import { FollowButton } from '@/components/follow/FollowButton';
import { MessageButton } from '@/components/messaging/MessageButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface SearchPageProps {
  onBack: () => void;
  onEventSelect: (eventId: string) => void;
}

const categories = [
  'All',
  'Music',
  'Food & Drink',
  'Art & Culture',
  'Sports & Fitness',
  'Business & Professional',
  'Network',
  'Technology',
  'Other'
];

const quickSearchPresets = [
  { label: 'Live music tonight', value: 'live music' },
  { label: 'Networking mixers', value: 'networking' },
  { label: 'Pop-up dining', value: 'food festival' },
  { label: 'Outdoor fitness', value: 'fitness class' },
];

// ————————————————————————————————————————
// Mock fallback (unchanged)
// ————————————————————————————————————————
const mockSearchResults = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    description: 'Three days of incredible music with top artists',
    organizer: 'LiveNation Events',
    organizerId: '101',
    category: 'Music',
    date: 'July 15, 2025',
    location: 'Central Park, NYC',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 1243,
    priceFrom: 89,
    rating: 4.8,
  },
  {
    id: '2',
    title: 'Street Food Fiesta',
    description: 'Taste authentic flavors from around the world',
    organizer: 'Foodie Adventures',
    organizerId: '102',
    category: 'Food & Drink',
    date: 'August 8, 2025',
    location: 'Brooklyn Bridge Park',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 567,
    priceFrom: 25,
    rating: 4.6,
  },
  {
    id: '3',
    title: 'Contemporary Art Showcase',
    description: 'Discover emerging artists and groundbreaking installations',
    organizer: 'Modern Gallery NYC',
    organizerId: '103',
    category: 'Art & Culture',
    date: 'September 2, 2025',
    location: 'SoHo Art District',
    coverImage: 'https://images.unsplash.com/photo-1713779490284-a81ff6a8ffae?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 298,
    priceFrom: 35,
    rating: 4.9,
  }
];

const LOCATION_UNKNOWN = 'Location TBD';
const EARTH_RADIUS_KM = 6371;

type LocationDetails = {
  full: string;
  short: string;
  display: string;
  city: string | null;
  state: string | null;
  country: string | null;
  isVirtual: boolean;
  keywords: string[];
};

type UserSearchResult = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  role: string | null;
  verification_status: string | null;
};

function toRadians(value: number) {

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          <header className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2 sm:flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-10 w-10 rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 sm:inline-flex"
                  onClick={onBack}
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="inline-flex h-10 w-full items-center justify-start gap-2 rounded-full border border-slate-200 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:hidden"
                  onClick={onBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <div className="relative hidden flex-1 sm:block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={q}
                    onChange={(e) => setParam('q', e.target.value)}
                    placeholder="Search events, organizers, or locations"
                    className="h-12 rounded-full border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm transition focus-visible:ring-2 focus-visible:ring-slate-900/20"
                  />
                </div>
              </div>

              <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
                <DialogTrigger asChild>
                  <Button className="h-12 w-full rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 sm:w-auto">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filters
                    {filtersAppliedCount > 0 && (
                      <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                        {filtersAppliedCount}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Filter events</DialogTitle>
                  </DialogHeader>
                  <FilterForm withFooter />
                </DialogContent>
              </Dialog>
            </div>

            <div className="sm:hidden">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setParam('q', e.target.value)}
                  placeholder="Search events, organizers, or locations"
                  className="h-12 rounded-full border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm transition focus-visible:ring-2 focus-visible:ring-slate-900/20"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {quickSearchPresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="secondary"
                  onClick={() => setParam('q', preset.value)}
                  className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  {preset.label}
                </Button>
              ))}
            </div>

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {activeFilters.map((filter) => (
                  <FilterChip key={`active-${filter.key}`} label={filter.label} onClear={filter.onClear} />
                ))}
                <Button variant="link" size="sm" onClick={clearAll} className="text-xs text-slate-600">
                  Clear all
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {city.trim() ? `Events in ${city}` : 'Discover events'}
                </p>
                <h1 className="text-2xl font-semibold text-slate-900">Find something happening soon</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {lastUpdatedAt && !isStale && (
                  <span>Updated {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}</span>
                )}
                {isStale && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                    <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
                    Updating
                  </span>
                )}
                {loading && !isInitialLoading && <span>Refreshing…</span>}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div>
                  <p className="text-xs font-medium text-slate-600">Include people in results</p>
                  <p className="text-[11px] text-slate-400">Connect with attendees and organizers</p>
                </div>
                <Switch id="include-users-toggle" checked={includeUsers} onCheckedChange={toggleIncludeUsers} />
              </div>
              <p className="text-xs text-slate-500">
                {resultsSummary}
              </p>
            </div>

            {!q && recent.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Recent searches</span>
                  <button type="button" onClick={clearRecent} className="text-slate-400 hover:text-slate-600">
                    Clear
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {recent.map((term) => (
                    <div
                      key={term}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm transition hover:bg-slate-100"
                    >
                      <button
                        type="button"
                        onClick={() => setParam('q', term)}
                        className="flex items-center gap-2"
                      >
                        <History className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate max-w-[140px] sm:max-w-none">{term}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecent(term)}
                        className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label={`Remove ${term}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </header>

          <main className="mt-6 space-y-10">
            <section className="space-y-6">
              {heroEvent && (
                <div className="space-y-3">
                  {heroSubtitle && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{heroSubtitle}</p>
                  )}
                  <h2 className="text-xl font-semibold text-slate-900">Spotlight event</h2>
                  <EventCard
                    event={heroEvent}
                    onClick={handleHeroClick}
                    onTicket={heroTicketHandler}
                    className="border border-slate-200 shadow-lg"
                  />
                </div>
              )}

              {isInitialLoading ? (
                <SkeletonGrid />
              ) : displayedResults.length === 0 ? (
                <EmptyState onReset={clearAll} />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {visible.map((event, index) => (
                      <EventCard
                        key={event.item_id || event.id || `event-${index}`}
                        event={event}
                        onClick={() => handleResultClick(event)}
                        onTicket={(eventId) => handleResultTicketClick(event, eventId)}
                      />
                    ))}
                  </div>
                  {(visibleCount < displayedResults.length || hasMore) && (
                    <div ref={loaderRef} className="flex h-12 items-center justify-center text-sm text-slate-500">
                      {loading ? 'Loading more…' : hasMore ? 'Scroll to load more results' : 'You have reached the end'}
                    </div>
                  )}
                  {hasMore && !loading && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={loadMore}
                        className="mt-2 rounded-full border-slate-200 px-6 py-2 text-sm text-slate-700 hover:bg-white"
                      >
                        Load more results
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>

            {recommendationsToRender.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">{recommendationsLabel}</h2>
                  <span className="text-sm text-slate-500">Based on your activity</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {recommendationsToRender.map((rec, index) => (
                    <EventCard
                      key={rec.eventId || `rec-${index}`}
                      event={rec.event}
                      onClick={() => handleRecommendationClick(rec.eventId)}
                      onTicket={(eventId) => handleRecommendationTicketClick(eventId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {includeUsers && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Community</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">People matching “{q}”</h2>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Switch id="include-users-toggle-desktop" checked={includeUsers} onCheckedChange={toggleIncludeUsers} />
                    <Label htmlFor="include-users-toggle-desktop">Show people</Label>
                  </div>
                </div>

                {userLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <Skeleton className="mt-4 h-9 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : userResults.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {userResults.map((person) => (
                      <div
                        key={person.user_id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            {person.photo_url ? <AvatarImage src={person.photo_url} alt={person.display_name} /> : null}
                            <AvatarFallback>{person.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{person.display_name}</p>
                              {person.verification_status === 'verified' && (
                                <Badge variant="secondary" className="text-[10px] uppercase">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 capitalize">{person.role || 'attendee'}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          {user?.id === person.user_id ? (
                            <span className="text-xs text-slate-400">This is you</span>
                          ) : (
                            <>
                              <FollowButton targetType="user" targetId={person.user_id} />
                              <MessageButton targetType="user" targetId={person.user_id} targetName={person.display_name} />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    No people matched your search yet.
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )

}
