import { useRef, useState, useMemo } from 'react';
import type { Event, EventPost } from '@/types/events';
import { PostHero } from '@/components/PostHero';

type Props = {
  event: Event;
  posts?: EventPost[];
  isActiveSlide: boolean;           // is this event's slide currently on screen (for video autoplay)
  index: number;                    // external controlled index
  onIndexChange: (next: number) => void;
  onOpenTickets: () => void;
  onPostClick: (postId: string, post?: EventPost) => void;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function PostCarousel({
  event,
  posts = [],
  isActiveSlide,
  index,
  onIndexChange,
  onOpenTickets,
  onPostClick,
}: Props) {
  // If no posts, let PostHero render the cover fallback
  const items = posts.length ? posts : [undefined as unknown as EventPost];

  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const widthPct = useMemo(() => 100 * items.length, [items.length]);

  const to = (i: number) => onIndexChange(clamp(i, 0, items.length - 1));

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };

  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (startX.current == null || startY.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // if mostly horizontal, prevent vertical scroll
    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();

    setDragX(dx);
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;

    const THRESHOLD = 50; // px
    if (Math.abs(dx) > THRESHOLD) {
      to(index + (dx < 0 ? 1 : -1));
    }

    startX.current = null;
    startY.current = null;
    setDragX(0);
    setDragging(false);
  };

  // Clickable arrows for desktop
  const Arrow = ({ dir }: { dir: 'left' | 'right' }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        to(index + (dir === 'right' ? 1 : -1));
      }}
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 ${dir === 'left' ? 'left-3' : 'right-3'} 
                 h-10 w-10 items-center justify-center rounded-full bg-black/40 border border-white/20 
                 text-white hover:bg-black/60 transition`}
      aria-label={dir === 'left' ? 'Previous post' : 'Next post'}
    >
      <span className="text-lg leading-none">{dir === 'left' ? '‹' : '›'}</span>
    </button>
  );

  // translate including drag offset for a nice follow finger effect
  const translate = `translateX(calc(${-index * 100}% + ${dragging ? dragX : 0}px))`;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: 'pan-x' }} // this tells the browser this zone is horizontal
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        ref={trackRef}
        className="h-full w-full flex"
        style={{
          width: `${widthPct}%`,
          transform: translate,
          transition: dragging ? 'none' : 'transform 280ms ease-out',
        }}
      >
        {items.map((post, i) => (
          <div key={post?.id ?? i} className="relative h-full w-full shrink-0" style={{ width: `${100 / items.length}%` }}>
            <PostHero
              post={post}
              event={event}
              isActive={isActiveSlide && i === index}
              onOpenTickets={onOpenTickets}
              onPostClick={(pid) => onPostClick(pid, post)}
            />
          </div>
        ))}
      </div>

      {/* Dots for the post pager */}
      {items.length > 1 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[10.5rem] flex gap-1.5 z-30">
          {items.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to post ${i + 1}`}
              onClick={(e) => { e.stopPropagation(); to(i); }}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}

      <Arrow dir="left" />
      <Arrow dir="right" />
    </div>
  );
}