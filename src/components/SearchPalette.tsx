import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Calendar, MapPin, Tag } from 'lucide-react';
import { useSmartSearch } from '@/hooks/useSmartSearch';
import { Button } from '@/components/ui/button';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onGoToEvent: (eventId: string) => void;
  onGoToPost?: (eventId: string, postId: string) => void;
  categories?: string[]; // provide if you have a fixed set
};

const LOCAL_KEY = 'yp_recent_searches_v1';

function useRecent() {
  const [items, setItems] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
  });
  const push = (q: string) => {
    const next = [q, ...items.filter(i => i !== q)].slice(0, 10);
    setItems(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  };
  const remove = (q: string) => {
    const next = items.filter(i => i !== q);
    setItems(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  };
  return { items, push, remove };
}

export function SearchPalette({ isOpen, onClose, onGoToEvent, onGoToPost, categories = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { q, setQ, filters, setFilters, results, loading, error, loadMore, pageSize } = useSmartSearch('');
  const { items: recent, push: pushRecent, remove: removeRecent } = useRecent();
  const [hover, setHover] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setHover((h) => Math.min(h + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHover((h) => Math.max(h - 1, 0)); }
      if (e.key === 'Enter') {
        const row = results[hover];
        if (row) handleNavigate(row);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, hover]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  const handleNavigate = (row: any) => {
    if (q.trim()) pushRecent(q);
    if (row.kind === 'event' || !row.post_id) {
      onGoToEvent(row.item_id);
    } else {
      onGoToPost?.(row.item_id, row.post_id);
    }
    onClose();
  };

  const groups = useMemo(() => {
    const ev = results.filter(r => r.kind === 'event');
    const posts = results.filter(r => r.kind === 'post');
    return { ev, posts };
  }, [results]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={onClose} aria-modal role="dialog">
      <div
        className="mx-auto mt-20 max-w-2xl rounded-xl border border-white/10 bg-neutral-900 text-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Input + quick filters */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="w-4 h-4 opacity-70" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search events, posts, locations…"
            className="flex-1 bg-transparent outline-none placeholder:text-white/40"
            aria-label="Search"
          />
          <div className="hidden sm:flex items-center gap-2">
            <button
              className={`text-xs px-2 py-1 rounded border ${filters.onlyEvents ? 'border-white' : 'border-white/20 text-white/70'}`}
              onClick={() => setFilters(f => ({ ...f, onlyEvents: !f.onlyEvents }))}
            >
              Events only
            </button>
            {/* category quick-select */}
            {categories.length > 0 && (
              <select
                value={filters.category ?? ''}
                onChange={(e) => setFilters(f => ({ ...f, category: e.target.value || null }))}
                className="text-xs bg-transparent border border-white/20 rounded px-2 py-1"
                aria-label="Category"
              >
                <option value="">All categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {/* date range quick-select: next 30 days / this weekend */}
            <button
              className="text-xs px-2 py-1 rounded border border-white/20 text-white/70"
              onClick={() => {
                const now = new Date();
                const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
                setFilters(f => ({ ...f, dateFrom: now.toISOString(), dateTo: in30.toISOString() }));
              }}
              title="Next 30 days"
            >
              Next 30d
            </button>
            <button
              className="text-xs px-2 py-1 rounded border border-white/20 text-white/70"
              onClick={() => {
                const now = new Date();
                const day = now.getDay();
                const sat = new Date(now); sat.setDate(now.getDate() + ((6 - day + 7) % 7));
                const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
                setFilters(f => ({ ...f, dateFrom: sat.toISOString(), dateTo: sun.toISOString() }));
              }}
              title="This weekend"
            >
              Weekend
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close search">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Recent searches */}
        {(!q && recent.length > 0) && (
          <div className="px-4 py-2 text-sm border-b border-white/10">
            <div className="mb-1 text-white/60">Recent</div>
            <div className="flex flex-wrap gap-2">
              {recent.map(r => (
                <button
                  key={r}
                  onClick={() => {
                    setQ(r);
                  }}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white/90"
                >
                  {r}
                  <span
                    className="ml-2 text-white/40 hover:text-white/70"
                    onClick={(e) => { e.stopPropagation(); removeRecent(r); }}
                    aria-label="Remove recent"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="px-4 py-6 text-red-300 text-sm">Search failed. Please try again.</div>
          )}
          {loading && results.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/70">Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-white/60">
              {q ? 'No matches. Try a different phrase or widen filters.' : 'Type to search events and posts.'}
            </div>
          )}

          {/* Events */}
          {groups.ev.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wide text-white/50">Events</div>
              <ul className="px-2">
                {groups.ev.map((row, idx) => {
                  const isH = results.indexOf(row) === hover;
                  return (
                    <li key={`ev-${row.item_id}-${idx}`}>
                      <button
                        onMouseEnter={() => setHover(results.indexOf(row))}
                        onClick={() => handleNavigate(row)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition ${
                          isH ? 'bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 shrink-0 opacity-70" />
                          <div className="flex-1">
                            <div className="font-medium">{row.title}</div>
                            <div className="text-xs text-white/60 flex items-center gap-2">
                              {row.starts_at && <span>{new Date(row.starts_at).toLocaleString()}</span>}
                              {row.location && (<span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3"/>{row.location}</span>)}
                              {row.category && (<span className="inline-flex items-center gap-1"><Tag className="w-3 h-3"/>{row.category}</span>)}
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

          {/* Posts */}
          {groups.posts.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wide text-white/50">Posts</div>
              <ul className="px-2">
                {groups.posts.map((row) => {
                  const isH = results.indexOf(row) === hover;
                  return (
                    <li key={`post-${row.post_id}`}>
                      <button
                        onMouseEnter={() => setHover(results.indexOf(row))}
                        onClick={() => handleNavigate(row)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition ${
                          isH ? 'bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="font-medium">{row.title}</div>
                        <div className="text-xs text-white/60 line-clamp-2">{row.snippet}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Load more */}
          {results.length > 0 && results.length % pageSize === 0 && (
            <div className="px-4 py-3">
              <Button onClick={loadMore} variant="secondary" className="w-full">Load more</Button>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-[11px] text-white/50">
          Tip: Press <kbd className="px-1 py-[1px] bg-white/10 rounded">⌘</kbd>/<kbd className="px-1 py-[1px] bg-white/10 rounded">Ctrl</kbd>+<kbd className="px-1 py-[1px] bg-white/10 rounded">K</kbd> to open search anywhere
        </div>
      </div>
    </div>
  );
}