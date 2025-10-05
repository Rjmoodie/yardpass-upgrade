// src/components/SearchPalette.tsx
import { useEffect, useMemo, useRef, useState, useCallback, useId } from 'react';
import { X, Search as SearchIcon, Calendar, MapPin, Tag } from 'lucide-react';
import { useSmartSearch, type SearchRow } from '@/hooks/useSmartSearch';
import { Button } from '@/components/ui/button';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onGoToEvent: (eventId: string) => void;
  onGoToPost?: (eventId: string, postId: string) => void;
  categories?: string[];
};

const LOCAL_KEY = 'yp_recent_searches_v1';

function useRecent() {
  const [items, setItems] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
  });
  const persist = (list: string[]) => localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  const push = (q: string) => {
    const cleaned = q.trim();
    if (!cleaned) return;
    const next = [cleaned, ...items.filter(i => i !== cleaned)].slice(0, 10);
    setItems(next); persist(next);
  };
  const remove = (q: string) => { const next = items.filter(i => i !== q); setItems(next); persist(next); };
  const clear = () => { setItems([]); persist([]); };
  return { items, push, remove, clear };
}

function highlight(text?: string, q?: string) {
  if (!text) return null;
  if (!q?.trim()) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-500/30 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function SearchPalette({
  isOpen,
  onClose,
  onGoToEvent,
  onGoToPost,
  categories = [],
}: Props) {
  const dlgId = useId();
  const listboxId = `${dlgId}-listbox`;
  const inputId = `${dlgId}-input`;
  const statusId = `${dlgId}-status`;

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounced query to avoid hammering the backend
  const [rawQ, setRawQ] = useState('');
  const { q, setQ, filters, setFilters, clearFilters, results, loading, error, loadMore, pageSize } = useSmartSearch('');
  useEffect(() => {
    const t = setTimeout(() => setQ(rawQ), 180);
    return () => clearTimeout(t);
  }, [rawQ, setQ]);

  const { items: recent, push: pushRecent, remove: removeRecent, clear: clearRecent } = useRecent();
  const [hover, setHover] = useState<number>(0);

  // Groupings for tidy UI
  const groups = useMemo(() => {
    const ev = results.filter(r => r.item_type === 'event');
    const posts = results.filter(r => r.item_type === 'post');
    return { ev, posts };
  }, [results]);

  // Focus & keyboard trap inside dialog
  useEffect(() => {
    if (!isOpen) return;
    const node = containerRef.current;
    if (!node) return;

    // Focus input on open
    setTimeout(() => inputRef.current?.focus(), 0);

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }

      // Arrow/Home/End across results
      if (results.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHover(h => Math.min(h + 1, results.length - 1)); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setHover(h => Math.max(h - 1, 0)); }
        if (e.key === 'Home')      { e.preventDefault(); setHover(0); }
        if (e.key === 'End')       { e.preventDefault(); setHover(results.length - 1); }
        if (e.key === 'PageDown')  { e.preventDefault(); setHover(h => Math.min(h + 5, results.length - 1)); }
        if (e.key === 'PageUp')    { e.preventDefault(); setHover(h => Math.max(h - 5, 0)); }
        if (e.key === 'Enter') {
          e.preventDefault();
          const row = results[hover];
          if (row) handleNavigate(row);
        }
      }

      // Focus trap
      if (e.key === 'Tab') {
        const els = focusables();
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, results, hover, onClose]);

  // Auto-load more on scroll bottom (keeps button as fallback)
  useEffect(() => {
    if (!isOpen || !sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && results.length && results.length % pageSize === 0 && !loading) {
          loadMore();
        }
      }
    }, { root: listRef.current, threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [isOpen, results.length, pageSize, loading, loadMore]);

  const handleNavigate = useCallback((row: SearchRow) => {
    if (rawQ.trim()) pushRecent(rawQ);
    if (row.item_type === 'event') {
      onGoToEvent(row.item_id);
    } else {
      const parent = row.parent_event_id || row.item_id;
      onGoToPost?.(parent, row.item_id);
    }
    onClose();
  }, [onClose, onGoToEvent, onGoToPost, pushRecent, rawQ]);

  // Quick filter helpers
  const setNext30Days = () => {
    const now = new Date();
    const to = new Date(now); to.setDate(to.getDate() + 30);
    setFilters(f => ({ ...f, dateFrom: now.toISOString(), dateTo: to.toISOString() }));
  };
  const setThisWeekend = () => {
    const now = new Date();
    const day = now.getDay();
    const sat = new Date(now); sat.setDate(now.getDate() + ((6 - day + 7) % 7));
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    setFilters(f => ({ ...f, dateFrom: sat.toISOString(), dateTo: sun.toISOString() }));
  };

  if (!isOpen) return null;

  const activeOptionId = results.length ? `${listboxId}-opt-${hover}` : undefined;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden={false}
    >
      <div
        ref={containerRef}
        className="mx-auto mt-20 max-w-2xl rounded-xl border border-white/10 bg-neutral-900 text-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dlgId}-title`}
        aria-describedby={statusId}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Input / Filters */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <SearchIcon className="w-4 h-4 opacity-70" aria-hidden />
          <div
            role="combobox"
            aria-expanded="true"
            aria-owns={listboxId}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            className="flex-1"
          >
            <input
              id={inputId}
              ref={inputRef}
              value={rawQ}
              onChange={e => setRawQ(e.target.value)}
              placeholder="Search events, posts, locations…"
              className="w-full bg-transparent outline-none placeholder:text-white/40"
              aria-label="Search"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Filter chips */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              className={`text-xs px-2 py-1 rounded border transition ${
                filters.onlyEvents ? 'border-white bg-white/10' : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
              onClick={() => setFilters(f => ({ ...f, onlyEvents: !f.onlyEvents }))}
              title="Show only events"
              aria-pressed={!!filters.onlyEvents}
            >
              Events only
            </button>

            {categories.length > 0 && (
              <select
                value={filters.category ?? ''}
                onChange={(e) => setFilters(f => ({ ...f, category: e.target.value || null }))}
                className="text-xs bg-transparent border border-white/20 rounded px-2 py-1 hover:border-white/40"
                aria-label="Category"
              >
                <option value="">All categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            <button
              className="text-xs px-2 py-1 rounded border border-white/20 text-white/80 hover:border-white/40"
              onClick={setNext30Days}
              title="Next 30 days"
            >
              Next 30d
            </button>
            <button
              className="text-xs px-2 py-1 rounded border border-white/20 text-white/80 hover:border-white/40"
              onClick={setThisWeekend}
              title="This weekend"
            >
              Weekend
            </button>

            {(filters.category || filters.onlyEvents || filters.dateFrom || filters.dateTo) && (
              <button
                className="text-xs px-2 py-1 rounded border border-white text-white"
                onClick={clearFilters}
                title="Clear filters"
              >
                Clear
              </button>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close search" title="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Recent searches (when idle) */}
        {(!rawQ && recent.length > 0) && (
          <div className="px-4 py-2 text-sm border-b border-white/10">
            <div id={`${dlgId}-title`} className="mb-1 text-white/60">Recent</div>
            <div className="flex flex-wrap gap-2">
              {recent.map(r => (
                <button
                  key={r}
                  onClick={() => setRawQ(r)}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white/90 transition"
                >
                  {r}
                  <span
                    className="ml-2 text-white/40 hover:text-white/70"
                    onClick={(e) => { e.stopPropagation(); removeRecent(r); }}
                    aria-label={`Remove ${r} from recent`}
                  >
                    ×
                  </span>
                </button>
              ))}
              <button
                className="px-2 py-1 rounded border border-white/10 hover:border-white/30 text-white/70"
                onClick={clearRecent}
                title="Clear recent searches"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* ARIA live region for status */}
        <div id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
          {loading ? 'Searching' : results.length ? `${results.length} results` : 'No results'}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto" role="region" aria-label="Search results">
          {error && (
            <div className="px-4 py-6 text-red-300 text-sm">Search failed. Please try again.</div>
          )}

          {/* Loading skeleton for first paint */}
          {loading && results.length === 0 && (
            <ul className="px-4 py-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="h-10 rounded bg-white/5 animate-pulse" />
              ))}
            </ul>
          )}

          {!loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-white/60">
              {rawQ ? 'No matches. Try a different phrase or widen filters.' : 'Type to search events and posts.'}
            </div>
          )}

          {/* Listbox (events) */}
          {groups.ev.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wide text-white/50">Events</div>
              <ul id={listboxId} role="listbox" aria-label="Event results" className="px-2" aria-busy={loading || undefined}>
                {groups.ev.map((row) => {
                  const idx = results.indexOf(row);
                  const isH = idx === hover;
                  const optId = `${listboxId}-opt-${idx}`;
                  return (
                    <li key={`ev-${row.item_id}`} role="option" id={optId} aria-selected={isH}>
                      <button
                        onMouseEnter={() => setHover(idx)}
                        onClick={() => handleNavigate(row)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition ${
                          isH ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 shrink-0 opacity-70" aria-hidden />
                          <div className="flex-1">
                            <div className="font-medium line-clamp-1">{highlight(row.title, rawQ)}</div>
                            <div className="text-xs text-white/70 flex flex-wrap items-center gap-2">
                              {row.start_at && <span>{new Date(row.start_at).toLocaleString()}</span>}
                              {row.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" aria-hidden />{highlight(row.location, rawQ)}
                                </span>
                              )}
                              {row.category && (
                                <span className="inline-flex items-center gap-1">
                                  <Tag className="w-3 h-3" aria-hidden />{row.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Listbox (posts) */}
          {groups.posts.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wide text-white/50">Posts</div>
              <ul role="listbox" aria-label="Post results" className="px-2" aria-busy={loading || undefined}>
                {groups.posts.map((row) => {
                  const idx = results.indexOf(row);
                  const isH = idx === hover;
                  const optId = `${listboxId}-opt-${idx}`;
                  return (
                    <li key={`post-${row.item_id}`} role="option" id={optId} aria-selected={isH}>
                      <button
                        onMouseEnter={() => setHover(idx)}
                        onClick={() => handleNavigate(row)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition ${
                          isH ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="font-medium line-clamp-1">{highlight(row.title, rawQ)}</div>
                        <div className="text-xs text-white/60 line-clamp-2">{highlight(row.description, rawQ)}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Infinite scroll sentinel + fallback button */}
          <div ref={sentinelRef} className="h-6" />
          {results.length > 0 && results.length % pageSize === 0 && (
            <div className="px-4 py-3">
              <Button onClick={loadMore} variant="secondary" className="w-full">Load more</Button>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-[11px] text-white/50">
          Tip: Press <kbd className="px-1 py-[1px] bg-white/10 rounded">⌘</kbd>/<kbd className="px-1 py-[1px] bg-white/10 rounded">Ctrl</kbd>
          +<kbd className="px-1 py-[1px] bg-white/10 rounded">K</kbd> to open search anywhere
        </div>
      </div>
    </div>
  );
}

export default SearchPalette;
