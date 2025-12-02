import { useMemo } from 'react';
import {
  ArrowRight,
  CalendarHeart,
  Flame,
  Gift,
  MapPin,
  Music4,
  PartyPopper,
  Snowflake,
  Sparkles,
  Star,
  Trees,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const quickFilters = [
  'All holiday events',
  'Family friendly',
  'Festive nightlife',
  'Food & drink',
  'Pop-up markets',
  'Virtual gatherings',
];

const spotlightEvents = [
  {
    title: 'Frost & Fire Winter Gala',
    category: 'Premium experience',
    date: 'Sat, Dec 16 • 7:00 PM',
    location: 'Brooklyn Navy Yard',
    description: 'Immersive dining, live orchestra, and rooftop winter garden.',
    accent: 'from $145',
    background: 'from-rose-200/70 via-amber-100/80 to-emerald-100/90',
  },
  {
    title: 'Holiday Makers Market',
    category: 'Community highlight',
    date: 'Sun, Dec 10 • 11:00 AM',
    location: 'Chelsea Arts District',
    description: '80+ independent vendors, craft workshops, and seasonal tastings.',
    accent: 'free entry',
    background: 'from-sky-200/70 via-indigo-100/80 to-fuchsia-100/80',
  },
  {
    title: 'Silent Disco on Ice',
    category: 'Trending now',
    date: 'Fri, Dec 22 • 9:00 PM',
    location: 'Bryant Park Rink',
    description: 'Three live DJs, heated lounge, and complimentary skate rentals.',
    accent: 'selling fast',
    background: 'from-emerald-200/70 via-teal-100/80 to-cyan-100/80',
  },
];

const curatedCollections = [
  {
    title: 'City Lights Tours',
    description: 'Guided routes through the most dazzling neighborhoods and displays.',
    stats: '12 experiences',
    gradient: 'from-emerald-500/90 via-green-400/80 to-lime-300/80',
    icon: Trees,
  },
  {
    title: 'After-Hours Celebrations',
    description: 'Late-night dance parties, rooftop gatherings, and speakeasy pop-ups.',
    stats: '18 events',
    gradient: 'from-fuchsia-500/90 via-pink-500/80 to-rose-400/80',
    icon: PartyPopper,
  },
  {
    title: 'Giving Back & Community',
    description: 'Volunteer drives, charity concerts, and purpose-driven meetups.',
    stats: '9 programs',
    gradient: 'from-amber-500/90 via-brand-400/80 to-yellow-300/80',
    icon: Gift,
  },
];

const destinationGuides = [
  {
    city: 'New York City',
    description: 'Pop-up markets, immersive theatre, and ice lounges across the boroughs.',
    highlight: '120+ holiday listings',
  },
  {
    city: 'Chicago',
    description: 'River cruises, festive bar crawls, and winter wonderland festivals.',
    highlight: 'Curated by locals',
  },
  {
    city: 'Los Angeles',
    description: 'Sunset concerts, maker fairs, and cozy mountain retreats nearby.',
    highlight: 'New this week',
  },
];

const editorialHighlights = [
  {
    title: 'Guide: Plan the ultimate team holiday outing',
    readTime: '6 minute read',
  },
  {
    title: 'How organizers create multi-sensory seasonal experiences',
    readTime: '4 minute read',
  },
  {
    title: 'Top community-driven markets to support this year',
    readTime: '5 minute read',
  },
];

const communityStats = [
  { label: 'Holiday hosts onboarded', value: '3,800+' },
  { label: 'Attendee RSVPs tracked', value: '240K' },
  { label: 'Curated city guides', value: '32' },
];

export function WebLandingPage() {
  const searchOptions = useMemo(
    () => [
      'All dates',
      'This weekend',
      'Next 7 days',
      'New Year’s Eve',
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
              <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-emerald-200">
                Liventix Holiday
              </p>
              <p className="font-semibold tracking-tight">Experiences & Ticketing</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-200 lg:flex">
            <a className="hover:text-white" href="#collections">Collections</a>
            <a className="hover:text-white" href="#spotlight">Spotlight</a>
            <a className="hover:text-white" href="#guides">City guides</a>
            <a className="hover:text-white" href="#host">Host on Liventix</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden text-slate-200 hover:text-white md:inline-flex">
              Log in
            </Button>
            <Button className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
              Get early access
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.35),_transparent_55%)]" />
          <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 py-16 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-8">
              <Badge className="bg-white/10 text-emerald-200">
                Featured Collection • Holiday 2024
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Holiday events that sparkle across every city
              </h1>
              <p className="max-w-xl text-lg text-slate-300">
                Discover immersive markets, elevated galas, and community gatherings curated by the Liventix team. Seamless ticketing, verified hosts, and experiences your guests will remember.
              </p>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
                <p className="text-sm font-semibold text-emerald-200">
                  Plan your next outing
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
                  <div className="grid gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      City or neighborhood
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300" aria-hidden="true" />
                      <Input
                        placeholder="Search by city, venue, or postal code"
                        className="border-white/10 bg-black/40 pl-11 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Date range
                    </label>
                    <Select defaultValue={searchOptions[0]}>
                      <SelectTrigger className="border-white/10 bg-black/40 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border border-white/10 bg-slate-900/95 text-slate-100">
                        {searchOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button size="lg" className="h-12 w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                      Explore events
                    </Button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <CalendarHeart className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <span>Personalized recommendations • Verified hosts • Secure checkout</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-4">
                {quickFilters.map((filter) => (
                  <button
                    key={filter}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-300 hover:bg-emerald-400/10 hover:text-white"
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <Snowflake className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                  <span>Trending for December</span>
                </div>
                <div className="mt-6 space-y-5">
                  {spotlightEvents.map((event) => (
                    <Card
                      key={event.title}
                      className={cn(
                        'border-none bg-gradient-to-br text-slate-900 shadow-lg transition hover:scale-[1.01] hover:shadow-xl',
                        event.background,
                      )}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-900/80">
                          <span>{event.category}</span>
                          <Badge className="bg-black/20 text-slate-900">{event.accent}</Badge>
                        </div>
                        <CardTitle className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                          {event.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-900/80">
                        <div className="flex items-center gap-2">
                          <CalendarHeart className="h-4 w-4" aria-hidden="true" />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          <span>{event.location}</span>
                        </div>
                        <p className="pt-2 text-slate-900/70">{event.description}</p>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button variant="ghost" className="group text-slate-900 hover:text-slate-900">
                          View details
                          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="spotlight" className="border-b border-white/5 bg-black/20 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-white">Curated spotlights</h2>
                <p className="mt-2 max-w-2xl text-slate-300">
                  Hand-picked experiences verified by our team. Each listing includes premium assets, marketing support, and attendee engagement tools.
                </p>
              </div>
              <Button variant="outline" className="border-emerald-400 text-emerald-200 hover:bg-emerald-400/10">
                See the full collection
              </Button>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {curatedCollections.map((collection) => (
                <Card
                  key={collection.title}
                  className={cn(
                    'relative overflow-hidden border-none bg-gradient-to-br text-white shadow-xl',
                    collection.gradient,
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_55%)]" />
                  <CardHeader className="relative">
                    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
                      <collection.icon className="h-5 w-5" aria-hidden="true" />
                      <span>Featured track</span>
                    </div>
                    <CardTitle className="mt-3 text-2xl text-white">
                      {collection.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative space-y-4 text-sm text-white/90">
                    <p>{collection.description}</p>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/70">
                      <Flame className="h-4 w-4" aria-hidden="true" />
                      {collection.stats}
                    </div>
                  </CardContent>
                  <CardFooter className="relative">
                    <Button variant="secondary" className="text-slate-900">
                      Browse experiences
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="guides" className="border-b border-white/5 bg-white/5 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-white">Local guides for every vibe</h2>
                <p className="mt-2 max-w-2xl text-slate-300">
                  Every city collection is curated with venue partners, trusted organizers, and neighborhood ambassadors.
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Users className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                <span>Updated daily by the Liventix community team</span>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {destinationGuides.map((guide) => (
                <Card key={guide.city} className="border-white/10 bg-black/40 p-6 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-400/20 text-emerald-200">Guide</Badge>
                    <span className="text-xs uppercase tracking-widest text-slate-400">Winter edit</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold text-white">{guide.city}</h3>
                  <p className="mt-3 text-sm text-slate-300">{guide.description}</p>
                  <div className="mt-6 flex items-center justify-between text-sm text-emerald-200">
                    <span>{guide.highlight}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/5 bg-black/40 py-16" id="collections">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr]">
              <div>
                <h2 className="text-3xl font-semibold text-white">Keep the celebrations going</h2>
                <p className="mt-3 text-slate-300">
                  Build your itinerary with themed collections designed for companies, families, and friends who want unforgettable seasonal moments.
                </p>

                <div className="mt-8 space-y-6">
                  {editorialHighlights.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                      <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Inspiration</p>
                      <h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3>
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                        <Star className="h-4 w-4 text-amber-300" aria-hidden="true" />
                        {item.readTime}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">Why hosts choose Liventix</p>
                <h3 className="mt-4 text-3xl font-semibold text-white">The all-in-one seasonal toolkit</h3>
                <p className="mt-4 text-sm text-slate-300">
                  Instant payouts, rich attendee insights, and collaborative planning tools built for teams and agencies.
                </p>

                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  {communityStats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/40 p-5 text-center">
                      <p className="text-2xl font-semibold text-emerald-200">{stat.value}</p>
                      <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <Separator className="my-8 border-white/10" />

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                    Seasonal campaign playbooks
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <Music4 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                    Integrated audio & lighting partners
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <Gift className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                    Merch, gifting, and loyalty extensions
                  </div>
                </div>

                <Button size="lg" className="mt-8 w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                  Access organizer tools
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="host" className="border-b border-white/5 bg-emerald-500/10 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1fr]">
              <div className="space-y-4">
                <Badge className="bg-emerald-400/20 text-emerald-900">For organizers</Badge>
                <h2 className="text-3xl font-semibold text-white">Host unforgettable seasonal experiences</h2>
                <p className="text-slate-200">
                  Launch an event in minutes with tiered ticketing, sponsor-ready landing pages, and post-event analytics.
                </p>
                <div className="space-y-3 text-sm text-slate-200">
                  <div className="flex items-start gap-3">
                    <Snowflake className="mt-0.5 h-5 w-5 text-emerald-200" aria-hidden="true" />
                    <p>Smart waitlists and segmented campaigns keep your VIPs in the loop.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <PartyPopper className="mt-0.5 h-5 w-5 text-emerald-200" aria-hidden="true" />
                    <p>Built-in community hub to share recaps, photos, and sponsor offers.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarHeart className="mt-0.5 h-5 w-5 text-emerald-200" aria-hidden="true" />
                    <p>Real-time dashboards and attendance tracking for every session.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-3">
                  <Button className="bg-white text-emerald-900 hover:bg-emerald-100">Create an event</Button>
                  <Button variant="outline" className="border-emerald-200 text-emerald-100 hover:bg-emerald-400/10">
                    Talk to our team
                  </Button>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur">
                <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-400/20" />
                <div className="absolute -bottom-32 -left-10 h-60 w-60 rounded-full bg-sky-400/10" />
                <div className="relative space-y-6">
                  <h3 className="text-2xl font-semibold text-white">Seasonal launch checklist</h3>
                  <div className="space-y-5">
                    {[
                      'Upload brand assets & playlist inspiration',
                      'Design custom ticket tiers with perks',
                      'Automate reminders, upsells, and sponsor spotlights',
                      'Review post-event insights and attendee sentiment',
                    ].map((step) => (
                      <div key={step} className="flex items-start gap-3 text-sm text-slate-200">
                        <Badge className="mt-0.5 bg-emerald-400/20 text-emerald-200">
                          <CheckmarkIcon />
                        </Badge>
                        <p>{step}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-sm font-semibold text-emerald-200">New</p>
                    <p className="mt-2 text-lg font-semibold text-white">Multi-city rollups & sponsor-ready analytics</p>
                    <p className="mt-3 text-sm text-slate-300">
                      Compare performance across locations, segment attendees, and share branded recaps with partners.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-black/60">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                <span className="text-lg font-semibold text-white">Liventix Holiday Network</span>
              </div>
              <p className="text-sm text-slate-400">
                Powered by the Liventix event platform. Built for organizers who lead with experience design and community.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                <a className="hover:text-white" href="#">About</a>
                <a className="hover:text-white" href="#">Pricing</a>
                <a className="hover:text-white" href="#">Support</a>
                <a className="hover:text-white" href="/privacy">Privacy</a>
                <a className="hover:text-white" href="/terms">Terms</a>
                <a className="hover:text-white" href="/community-guidelines">Guidelines</a>
              </div>
            </div>
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                Stay in the loop
              </p>
              <p className="text-sm text-slate-300">
                Weekly digest of new experiences, production tips, and early-access launches.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="you@example.com"
                  type="email"
                  className="border-white/10 bg-black/40 text-slate-100 placeholder:text-slate-500"
                />
                <Button className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">Notify me</Button>
              </div>
              <p className="text-xs text-slate-500">
                By subscribing, you agree to receive updates from Liventix. You can opt out anytime.
              </p>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-500">
            © {new Date().getFullYear()} Liventix. Crafted with care for seasonal storytellers.
          </div>
        </div>
      </footer>
    </div>
  );
}

function CheckmarkIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path
        d="M16.667 5 7.5 14.167 3.333 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default WebLandingPage;
