import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
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

interface SearchPageProps {
  onBack: () => void;
  onEventSelect: (eventId: string) => void;
}

const categories = [
  'All', 'Music', 'Food & Drink', 'Art & Culture', 'Sports & Fitness', 
  'Business & Professional', 'Community', 'Technology', 'Other'
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

function toRadians(value: number) {
  return (
    <div className="min-h-screen bg-[#f6f0e8] text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-24">
        <header className="flex flex-col gap-6 py-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="mt-1 h-11 w-11 rounded-full border border-transparent bg-white/80 shadow-sm backdrop-blur transition hover:border-slate-200 hover:shadow"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Discover</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Explore events & experiences
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Search by vibe, location, and date to find memorable things to do. YardPass surfaces trending picks and curated gems just for you.
              </p>
            </div>
          </div>
          <div className="hidden min-w-[160px] flex-col items-end gap-1 text-right text-xs text-slate-500 sm:flex">
            <span>
              {displayedResults.length > 0
                ? `${displayedResults.length} ${displayedResults.length === 1 ? 'match' : 'matches'} ready`
                : 'Fresh events added hourly'}
            </span>
            {totalFetched > displayedResults.length && (
              <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] text-slate-500 shadow-sm">
                {totalFetched} total fetched
              </span>
            )}
          </div>
        </header>

        <section className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Smart discovery powered by YardPass
            </div>

            <div className="grid gap-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
              <div className="space-y-4">
                <div>
                  <label htmlFor="search-query-input" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Find events
                  </label>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="search-query-input"
                      value={q}
                      onChange={(e) => setParam('q', e.target.value)}
                      placeholder="Search events, organizers, or locations (press / to focus)"
                      className="h-12 rounded-2xl border-slate-200 bg-white/90 pl-11 text-base shadow-sm transition focus-visible:ring-2 focus-visible:ring-slate-900/20"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Try “live music”, “comedy night”, or “startup meetup”. We’ll keep your recent searches handy.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Where</label>
                  <div className="mt-2 flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={city}
                        onChange={(e) => setParam('city', e.target.value)}
                        placeholder="City or virtual"
                        className="h-12 rounded-2xl border-slate-200 bg-white/90 pl-11 text-base shadow-sm transition focus-visible:ring-2 focus-visible:ring-slate-900/20"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="h-12 rounded-2xl border-slate-200 bg-white/90 px-4 text-sm text-slate-700 shadow-sm transition hover:bg-white"
                      onClick={requestCurrentLocation}
                      disabled={isLocating}
                    >
                      <LocateFixed className="mr-2 h-4 w-4" />
                      {isLocating ? 'Locating…' : 'Near me'}
                    </Button>
                  </div>
                  {userLocationLabel && (
                    <p className="mt-1 text-xs text-slate-500">Using {userLocationLabel}</p>
                  )}
                  {locationError && (
                    <p className="mt-1 text-xs text-rose-500">{locationError}</p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'mt-2 h-12 w-full justify-start rounded-2xl border-slate-200 bg-white/90 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white',
                            !from && 'text-slate-400'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {from ? format(new Date(from), 'MMM dd, yyyy') : 'Any date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="start">
                        <Calendar
                          mode="single"
                          selected={from ? new Date(from) : undefined}
                          onSelect={(d) => setParam('from', d ? d.toISOString() : undefined)}
                          className="rounded-xl border"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'mt-2 h-12 w-full justify-start rounded-2xl border-slate-200 bg-white/90 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white',
                            !to && 'text-slate-400'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {to ? format(new Date(to), 'MMM dd, yyyy') : 'Any date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="start">
                        <Calendar
                          mode="single"
                          selected={to ? new Date(to) : undefined}
                          onSelect={(d) => setParam('to', d ? d.toISOString() : undefined)}
                          className="rounded-xl border"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={setTonight}
                  className="rounded-full bg-slate-900 text-white shadow hover:bg-slate-800"
                >
                  Tonight
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={setWeekend}
                  className="rounded-full bg-slate-900/90 text-white shadow hover:bg-slate-800"
                >
                  This weekend
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={set30d}
                  className="rounded-full bg-slate-900/80 text-white shadow hover:bg-slate-800"
                >
                  Next 30 days
                </Button>
              </div>

              <div className="flex-1" />

              <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
                <SelectTrigger className="h-12 min-w-[180px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-slate-900/20">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="min-w-[200px]">
                  <SelectItem value="date_asc">Soonest first</SelectItem>
                  <SelectItem value="price_asc">Price · Low to High</SelectItem>
                  <SelectItem value="price_desc">Price · High to Low</SelectItem>
                  <SelectItem value="attendees_desc">Most popular</SelectItem>
                </SelectContent>
              </Select>

              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-5 text-sm text-slate-700 shadow-sm transition hover:bg-white">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    More filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">Refine results</h3>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2 text-xs text-slate-500">
                          Clear all
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)} className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Min price ($)</label>
                        <Input
                          inputMode="numeric"
                          value={min}
                          onChange={(e) => setParam('min', e.target.value)}
                          placeholder="0"
                          className="mt-2 h-10 rounded-xl border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Max price ($)</label>
                        <Input
                          inputMode="numeric"
                          value={max}
                          onChange={(e) => setParam('max', e.target.value)}
                          placeholder="Any"
                          className="mt-2 h-10 rounded-xl border-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {(q || city || min || max || from || to || cat !== 'All') && (
              <div className="flex flex-wrap items-center gap-2">
                {cat !== 'All' && <FilterChip label={`Category: ${cat}`} onClear={() => setParam('cat', 'All')} />}
                {q && <FilterChip label={`"${q}"`} onClear={() => setParam('q')} />}
                {city && <FilterChip label={`City: ${city}`} onClear={() => setParam('city')} />}
                {min && <FilterChip label={`Min $${min}`} onClear={() => setParam('min')} />}
                {max && <FilterChip label={`Max $${max}`} onClear={() => setParam('max')} />}
                {from && <FilterChip label={`From ${format(new Date(from), 'MMM dd')}`} onClear={() => setParam('from')} />}
                {to && <FilterChip label={`To ${format(new Date(to), 'MMM dd')}`} onClear={() => setParam('to')} />}
                <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-3 text-xs text-slate-500">
                  Reset all
                </Button>
              </div>
            )}

            {locationSuggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Popular locations</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {locationSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => setParam('city', suggestion.label)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white"
                    >
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Button
                  key={c}
                  variant={cat === c ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm transition',
                    cat === c
                      ? 'border-slate-900 bg-slate-900 text-white shadow'
                      : 'border-slate-200 bg-white/90 text-slate-600 hover:border-slate-300 hover:bg-white'
                  )}
                  onClick={() => setParam('cat', cat === c ? 'All' : c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          </div>

          {!q && recent.length > 0 && (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Recent searches</p>
                <Button variant="ghost" size="sm" onClick={clearRecent} className="h-7 px-3 text-xs text-slate-500">
                  Clear
                </Button>
              </div>
              <ul className="mt-3 space-y-2">
                {recent.map((term) => (
                  <li
                    key={term}
                    className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => setParam('q', term)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <History className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{term}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecent(term)}
                      className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {heroEvent && (
          <section className="mt-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {heroSubtitle && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{heroSubtitle}</p>
                )}
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Spotlight event</h2>
              </div>
              {displayedResults.length > 0 && (
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-slate-500 shadow-sm">
                  {displayedResults.length} {displayedResults.length === 1 ? 'match' : 'matches'}
                </span>
              )}
            </div>
            <EventCard
              event={heroEvent}
              onClick={handleHeroClick}
              onTicket={heroTicketHandler}
              className="border-none shadow-[0_40px_90px_-60px_rgba(15,23,42,0.55)]"
            />
          </section>
        )}

        {recommendationsToRender.length > 0 && (
          <section className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">{recommendationsLabel}</h2>
              <span className="text-sm text-slate-500">Based on your activity</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {recommendationsToRender.map((rec) => (
                <EventCard
                  key={rec.eventId}
                  event={rec.event}
                  onClick={() => handleRecommendationClick(rec.eventId)}
                  onTicket={(eventId) => handleRecommendationTicketClick(eventId)}
                />
              ))}
            </div>
          </section>
        )}

        {error && (
          <div className="mt-10 rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-rose-600 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">We hit a snag while searching</p>
                <p className="text-sm opacity-80">
                  {error instanceof Error ? error.message : 'Please try again in a moment.'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={retry}
                className="h-10 rounded-full border-rose-200 px-4 text-sm text-rose-600 hover:bg-rose-100/60"
              >
                Retry search
              </Button>
            </div>
          </div>
        )}

        <section className="mt-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {city.trim() ? `Events in ${city}` : 'All events'}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Search results</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{resultsSummary}</span>
              {isStale && (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                  <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
                  Updating…
                </span>
              )}
              {lastUpdatedAt && !isStale && (
                <span>Updated {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}</span>
              )}
              {loading && !isInitialLoading && <span>Refreshing…</span>}
            </div>
          </div>

          {isInitialLoading ? (
            <SkeletonGrid />
          ) : displayedResults.length === 0 ? (
            <EmptyState onReset={clearAll} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {visible.map((event) => (
                  <EventCard
                    key={event.id}
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
      </div>
    </div>
  );
}
