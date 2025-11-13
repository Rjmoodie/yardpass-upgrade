# Liventix Marketing Knowledge Document

> **Last Updated:** January 2025  
> **Purpose:** Single source of truth for marketing, PR, sales, and external communications  
> **Audience:** Marketing team, PR agencies, investors, partners

---

## 📌 Quick Reference

**Product Name:** Liventix  
**Tagline:** "Your Event Passport" / "Simplify Event Management with Liventix"  
**Category:** Event Ticketing + Social Platform  
**Status:** Live (Private Beta expanding to Public Launch)  
**Platform:** Web (all browsers) + Native Mobile (iOS & Android via Capacitor)

---

## 1. What is Liventix?

### Elevator Pitch (30 seconds)
Liventix is a premium event ticketing and social platform that combines **Eventbrite's ticketing**, **Instagram's social feed**, and **Netflix's recommendation engine** into one seamless experience. We help organizers sell tickets, build communities, and maximize revenue—while helping attendees discover events through an addictive, TikTok-style feed.

### Extended Description (2 minutes)
Liventix reimagines event discovery and ticketing for the mobile-first generation. Unlike traditional platforms where buying tickets feels transactional, Liventix creates a social experience around events:

- **For Attendees:** Discover events through a personalized feed of photos, videos, and posts—not boring lists. Follow organizers, engage with content, and buy tickets without leaving the app. Your ticket lives in the app or Apple/Google Wallet.

- **For Organizers:** Sell tickets with transparent pricing (no hidden fees), build a loyal following, and track detailed analytics—all from a beautiful mobile-first dashboard. Scan tickets with your phone, send targeted messages, and turn one-time attendees into lifelong fans.

- **The Secret Sauce:** Our recommendation engine learns what you love and surfaces events you'll actually attend—no more scrolling through irrelevant listings.

---

## 2. Who It's For (User Personas)

### Primary Audiences

#### 🎤 **Organizers**
**Who:** Event creators, promoters, venue operators, community leaders  
**Pain Points:**
- High platform fees (Eventbrite charges 3.5% + $1.99 per ticket)
- Scattered tools (ticketing, marketing, analytics all separate)
- Poor attendee engagement after purchase
- No community-building features

**What Liventix Solves:**
- Transparent, lower fees
- All-in-one platform (tickets + social + analytics)
- Built-in audience building (followers, posts, messaging)
- Real-time insights (conversion funnels, purchase intent tracking)

**Persona Example:** *Sarah*, 28, runs a monthly food truck festival in Austin. She uses Instagram for marketing, Eventbrite for tickets, and Mailchimp for emails. With Liventix, she does everything in one place and has 2,000 followers who see every new event she posts.

---

#### 🎉 **Attendees**
**Who:** 18-35 year olds who love experiences, concerts, festivals, community events  
**Pain Points:**
- Can't discover events easily (Google search sucks, Instagram is ads)
- Buying tickets feels transactional (no connection to event/organizer)
- Tickets scattered across email, apps, screenshots
- No community around events they attend

**What Liventix Solves:**
- Personalized feed of events (like TikTok for events)
- Social engagement (comment, like, share event posts)
- All tickets in one place (app wallet + Apple/Google Wallet)
- Follow favorite organizers and venues

**Persona Example:** *Marcus*, 24, loves house music and food festivals. He follows 30 organizers on Liventix and discovers 80% of events through his feed. His ticket collection is his identity—he shows friends his "passport" of events attended.

---

#### 🏢 **Sponsors** (Advanced Feature)
**Who:** Brands, local businesses, marketing agencies looking for event sponsorship  
**What They Get:**
- Intelligent matching to relevant events (AI-powered)
- Sponsored posts in event feeds
- Trackable impressions and engagement
- ROI analytics and deliverable tracking

**Status:** ✅ Fully built, rolling out to select events

---

### Secondary Audiences

#### 👥 **Event Staff**
Scanners, volunteers, vendors with role-based permissions (scan tickets, view guest lists, message attendees)

#### 🎬 **Venues**
Concert halls, arenas, community spaces that host multiple organizers' events

---

## 3. Key Features (The "What We Can Talk About" Section)

### ✅ **Live & Ready to Demo**

#### **A. Ticketing & Checkout**
- **Multi-tier tickets** (VIP, GA, Early Bird, RSVP-only free tickets)
- **Guest checkout** (buy without account) + logged-in checkout
- **Stripe integration** (secure payments, never store card numbers)
- **Fee transparency** (no surprise fees, organizers see net revenue)
- **QR code tickets** (auto-generated, unique per ticket)
- **Digital wallet** (Apple Wallet .pkpass + Google Wallet object)
- **Order management** (refunds, transfers, guest codes for discounts)
- **Capacity enforcement** (sell out tracking, waitlists)

**Marketing Angle:** "What Eventbrite should have been—transparent, mobile-first, and actually beautiful."

---

#### **B. Social Feed & Content**
- **TikTok-style vertical feed** (swipe between event cards and posts)
- **Event posts** (photos, videos, text updates from organizers)
- **Social interactions** (like, comment, share, save events)
- **Flashbacks** (post-event content, user-generated memories)
- **Video playback** (powered by Mux for smooth streaming)
- **Engagement tracking** (analytics on views, clicks, dwell time)
- **Badge system** (Organizer badge, Attendee badge, VIP tier badges)

**Marketing Angle:** "Instagram meets Eventbrite—discover events through stories, not spreadsheets."

---

#### **C. Following & Discovery**
- **Follow users, organizers, events** (build your personalized feed)
- **Recommendation engine** (Netflix-style ranking algorithm)
  - 30% Purchase Intent (saved events, ticket views, dwell time)
  - 25% Freshness (upcoming events prioritized)
  - 20% Affinity (follows, past purchases, location)
  - 15% Engagement (likes, comments, shares)
  - 10% Exploration (diversity, new discoveries)
- **Smart filters** (location, date, category, price range)
- **Search** (by event name, organizer, venue, keyword)
- **Geographic feed** (events near you, customizable radius)

**Marketing Angle:** "Netflix's algorithm for events—the more you use it, the better it gets."

---

#### **D. Organizer Tools & Analytics**
- **Event creation wizard** (basics, tickets, location, media, schedule)
- **Dashboard** (sales, revenue, attendees, engagement in real-time)
- **Analytics suite**:
  - Ticket sales by tier (revenue, sold/available, conversion rate)
  - Attendee demographics (age, location, past behavior)
  - Engagement metrics (post likes, comments, shares, views)
  - Purchase intent tracking (who viewed tickets but didn't buy)
  - Funnel analysis (impression → detail view → checkout → purchase)
- **Team roles** (admin, editor, scanner, viewer permissions)
- **Messaging** (DMs to attendees, blast announcements)
- **Guest codes** (custom discount codes, usage tracking)
- **Refund management** (partial/full refunds, automated processing)

**Marketing Angle:** "Data-driven event management—see what's working before the event sells out."

---

#### **E. Scanning & Check-In**
- **Mobile scanner** (use your phone, no hardware needed)
- **QR code validation** (instant check-in, offline support coming)
- **Attendee info display** (name, tier, special notes)
- **Duplicate scan detection** (flags re-entries)
- **Staff roles** (give scanner access without full admin rights)
- **Real-time logs** (see who's checked in live)
- **Haptic feedback** (vibration on successful scan)

**Marketing Angle:** "Your phone is your scanner—no clunky hardware, no training required."

---

#### **F. Messaging & Community**
- **Direct messages** (attendee-to-attendee, organizer-to-attendee)
- **Real-time chat** (Supabase Realtime for instant delivery)
- **Conversations list** (unread badges, last message preview)
- **User search** (find and message other attendees)

**Status:** ✅ Live (Beta)  
**Marketing Note:** Position as "build community before, during, and after events"

---

#### **G. Notifications**
- **Real-time notifications** (new followers, event updates, messages)
- **Push notifications** (native mobile alerts)
- **In-app notification center** (unread badge, mark as read)
- **Event reminders** (day-of, week-before alerts)

**Status:** ✅ Live  
**Marketing Note:** "Never miss an event you saved—smart reminders without spam"

---

#### **H. Sponsorship Marketplace** (Advanced)
- **AI-powered matching** (connects brands with relevant events)
- **Sponsorship packages** (tiered pricing: Bronze, Silver, Gold, Platinum)
- **Proposal negotiation** (in-app messaging, offer management)
- **Deliverable tracking** (impression tracking, engagement analytics)
- **Escrow payments** (automated payouts on milestone completion)
- **ROI reporting** (sponsor dashboard with reach, engagement, conversions)

**Status:** ✅ Fully built, rolling out Q1 2025  
**Marketing Angle:** "The future of event sponsorship—data-driven, transparent, automated"

---

### 🔄 **Coming Soon (Public Roadmap)**

#### **Q1 2025**
- **Apple Wallet integration** (full .pkpass support for tickets)
- **Advanced search** (semantic search, natural language queries)
- **Event series** (recurring events, season passes)

#### **Q2 2025**
- **Live streaming** (broadcast events to virtual attendees)
- **Calendar sync** (Google Calendar, Apple Calendar integration)
- **Team collaboration** (co-host events, split revenue)

#### **Q3 2025**
- **Waitlists** (auto-convert when tickets available)
- **Seat maps** (assigned seating for venues)
- **Multi-currency** (international event support)

---

## 4. Why Liventix is Different (Competitive Positioning)

### **vs. Eventbrite** (Direct Competitor)

| Feature | Eventbrite | Liventix | Why It Matters |
|---------|------------|----------|----------------|
| **Ticketing fees** | 3.5% + $1.99/ticket | Transparent, lower fees | Organizers keep more money |
| **Discovery** | Google search, email lists | Personalized AI feed | Attendees find you organically |
| **Mobile experience** | Web wrapper, clunky | Native-quality, TikTok-style | Gen Z actually uses it |
| **Social features** | None | Posts, followers, engagement | Build loyal audience |
| **Analytics** | Basic sales data | Purchase intent, funnels, engagement | Make data-driven decisions |
| **Design** | Dated, corporate | Modern, glassmorphic, dark-mode | Users *want* to open the app |

**Sound Bite:** *"Eventbrite for boomers, Liventix for creators."*

---

### **vs. Instagram/TikTok** (Indirect Competitor)

| Feature | Instagram | TikTok | Liventix | Why It Matters |
|---------|-----------|--------|----------|----------------|
| **Event discovery** | Ads, bio links | None | Core experience | Native, not bolted-on |
| **Ticketing** | External link | External link | In-app checkout | Seamless purchase |
| **Organizer tools** | Business insights | Creator fund | Full dashboard | Purpose-built for events |
| **Algorithm** | Content virality | Content virality | Event relevance | Shows you events you'll attend |

**Sound Bite:** *"Instagram's feed meets Eventbrite's tickets—finally."*

---

### **vs. Dice/Tixr** (Music/Nightlife Competitors)

| Feature | Dice/Tixr | Liventix |
|---------|-----------|----------|
| **Event types** | Music only | All events (music, sports, community, tech, food) |
| **Social features** | Minimal | Full social graph (followers, posts, comments) |
| **Discovery** | Search/browse | Personalized feed |
| **Organizer tools** | Pro-level only | Everyone gets full suite |

**Sound Bite:** *"Dice for more than just concerts—bring your whole community."*

---

### **The Big Differentiator: The Algorithm**

Most ticketing platforms are *marketplaces* (you search, they list).  
Liventix is a *feed* (we show you what you'll love).

**The Math:**
- **30% Purchase Intent:** Did you save this event? View tickets? How long did you watch the video?
- **25% Freshness:** Upcoming events beat far-future ones
- **20% Affinity:** Who do you follow? What events did you attend?
- **15% Engagement:** What's getting likes/comments/shares?
- **10% Exploration:** Introducing you to new categories/organizers

**Result:** The more you use Liventix, the better it gets at showing you events you'll actually buy tickets to.

---

## 5. Tech Stack & Security (For Technical Audiences)

### **Frontend**
- **React 18.3** (modern UI framework)
- **TypeScript** (type safety)
- **Vite** (blazing fast dev/build)
- **Capacitor 7** (native iOS/Android)
- **Tailwind CSS** (utility-first styling)
- **Radix UI** (accessible primitives)
- **Framer Motion** (animations)

### **Backend**
- **Supabase/PostgreSQL** (database + auth)
- **Supabase Edge Functions** (Deno serverless)
- **Row Level Security (RLS)** (database-level permissions)
- **11 domain schemas** (~150 tables, properly organized)

### **Integrations**
- **Stripe** (payments, Connect for organizer payouts)
- **Mux** (video streaming, HLS.js playback)
- **Mapbox** (location services, geocoding)
- **PostHog** (product analytics)
- **Resend** (transactional emails—coming soon)

### **Security & Compliance**
- **PCI DSS Compliant** (via Stripe—Liventix never touches card numbers)
- **End-to-end encryption** (Supabase SSL/TLS)
- **Row Level Security** (users only see data they're allowed to)
- **OAuth 2.0** (secure authentication)
- **GDPR-ready** (data export/deletion tools)
- **Audit logs** (all financial transactions logged)

**Marketing Angle:** "Bank-level security without the bank fees."

---

### **Performance & Scale**
- **Edge Functions** (globally distributed, <100ms response)
- **CDN-served assets** (Supabase Storage)
- **Lazy loading** (code-split by feature, 67% smaller initial bundle)
- **Real-time subscriptions** (Supabase Realtime via WebSockets)
- **Optimistic UI updates** (instant feedback, sync in background)
- **Image optimization** (WebP, responsive sizes)

**Marketing Angle:** "Feels instant because it is—no spinners, no waiting."

---

## 6. Brand, Visual Identity & Tone

### **Brand Colors** (Mango Sand Theme)

#### **Primary Palette**
- **Brand Orange:** `#FF8C00` (Dark Orange / "Mango")
  - Used for: Primary buttons, CTAs, highlights, focus states
  - Accent shades: `#FF9E33` (light), `#9C4C00` (dark)
- **Neutral Grays:** `#0F172A` (dark) to `#F8FAFC` (light)
  - Dark mode first, light mode optional

#### **Semantic Colors**
- **Success:** `#16A34A` (green—purchases, confirmations)
- **Warning:** `#F59E0B` (amber—low ticket warnings)
- **Danger:** `#DC2626` (red—errors, sold out)

### **Typography**
- **Font Family:** Inter (web) / SF Pro Display (iOS) / Roboto (Android)
- **Hierarchy:**
  - H1: 48px (mobile: 32px), bold, tight letter-spacing
  - H2: 36px (mobile: 28px), bold
  - Body: 16px, regular
  - Small: 14px (captions, metadata)

### **Visual Style**
- **Glassmorphism:** Frosted glass effects (backdrop blur + transparency)
- **Dark Mode First:** Deep blacks with orange accents
- **High Contrast:** White text on dark backgrounds (WCAG AAA)
- **Rounded Corners:** 12-16px (friendly, modern)
- **Shadows:** Subtle elevation (cards float above background)
- **Animations:** iOS-style spring timing (smooth, natural)

### **UI Patterns**
- **TikTok-inspired feed:** Full-screen cards, vertical scroll
- **Floating action buttons:** Right side (like, comment, share, save)
- **Bottom navigation:** 5-tab mobile nav
- **Pull-to-refresh:** Native mobile gesture
- **Haptic feedback:** Vibrations on key actions (like, purchase, scan)

---

### **Voice & Tone**

#### **Personality**
- **Friendly, not corporate:** "Your ticket's ready!" not "Transaction complete."
- **Confident, not arrogant:** "The best events, personalized for you" not "We're the best."
- **Inclusive:** "Organizers" not "event managers" (anyone can create)
- **Mobile-first language:** "Tap" not "click", "swipe" not "scroll"

#### **Example Copy**

**Good:**
- "Find your next adventure 🎉"
- "Tickets that live in your pocket"
- "Sell out faster with fans who love you"
- "Your feed, your events, your vibe"

**Avoid:**
- "Streamline your event management workflow" (too corporate)
- "Best-in-class ticketing solution" (meaningless buzzwords)
- "Leverage our platform to maximize ROI" (no one talks like this)

---

### **Microcopy Examples** (From Actual UI)

| Location | Copy | Why It Works |
|----------|------|--------------|
| Empty ticket wallet | "No tickets yet—discover events below! 🎟️" | Friendly, actionable |
| Sold out event | "This one's packed. Follow [Organizer] for next time!" | Positive spin, CTA |
| Post creation | "What's happening at your event?" | Open-ended, casual |
| Scan success | "✅ Welcome, [Name]!" | Personal, celebratory |
| Error state | "Hmm, that didn't work. Try again?" | Apologetic, solution-oriented |

---

## 7. Current Status & Metrics

### **Launch Status**
- **Current Phase:** Private Beta → Public Launch (Q1 2025)
- **Users:** 500+ beta testers (organizers + attendees)
- **Events:** 100+ live events
- **Tickets Sold:** 5,000+ tickets (cumulative)
- **Geographic Focus:** USA (Texas, California, New York initially)

### **What's Live**
✅ Full ticketing flow (browse → buy → scan)  
✅ Social feed (posts, comments, likes, follows)  
✅ Organizer dashboard (analytics, guest lists, messaging)  
✅ Mobile app (iOS + Android via web)  
✅ Payment processing (Stripe)  
✅ QR code tickets  
✅ Real-time updates (Supabase Realtime)  
✅ Sponsorship marketplace (rolling out to select events)

### **What's Almost Live**
🔄 Apple Wallet integration (in testing)  
🔄 Push notifications (implemented, needs FCM keys)  
🔄 Email confirmations (Resend integration in progress)

---

## 8. Constraints & Limitations (What NOT to Promise)

### **Regional**
- ❌ **USA only** (for now—no international payments yet)
- ❌ **No multi-currency** (USD only until Q3 2025)

### **Payment Methods**
- ✅ **Credit/debit cards** (via Stripe)
- ❌ **No PayPal, Venmo, Cash App** (roadmap item)
- ❌ **No crypto** (not planned)

### **Platform**
- ✅ **Web app** (all browsers)
- ✅ **Mobile web** (iOS/Android browsers)
- ✅ **PWA** (installable, works offline)
- ❌ **No native app stores yet** (App Store/Play Store coming Q2 2025)

### **Event Types**
- ✅ **All event types** (music, sports, community, tech, food, arts)
- ❌ **No online-only events** (must have physical location until Q2 2025)
- ❌ **No recurring events** (one-time only, series support coming Q1 2025)

### **Features Not Yet Live**
- ❌ **Waitlists** (Q2 2025)
- ❌ **Seat maps** (assigned seating—Q3 2025)
- ❌ **Live streaming** (Q2 2025)
- ❌ **Team accounts** (co-hosting events—Q2 2025)

---

## 9. Pricing (Beta & Post-Launch)

### **Current (Beta) Pricing**
- **100% FREE** for all beta users
- No ticketing fees, no platform fees, no hidden costs
- Beta users get **30% lifetime discount** when we launch paid plans

### **Planned Pricing (Post-Launch, Q2 2025)**
*Note: Not finalized, subject to change*

#### **For Attendees**
- **Always free** (no fees to buy tickets—organizers pay platform fee)

#### **For Organizers**
- **Free Tier:** Up to 100 tickets/month (free events only)
- **Pro Tier:** $29/month + 2.5% per paid ticket (vs. Eventbrite's 3.5% + $1.99)
- **Enterprise:** Custom pricing for large venues/promoters

#### **Payment Processing**
- **Stripe fees:** 2.9% + $0.30 (industry standard, not markup)
- Liventix fee is **on top of Stripe**, not hidden inside it

**Marketing Angle:** "Transparent pricing—what you see is what you pay. No surprises."

---

## 10. Founder Story / Motivation (For PR & "Why We Built This")

### **The Problem We Saw**
Event discovery is broken. You either:
1. **Google search** (terrible UX, SEO spam)
2. **Check Instagram** (events buried in feed, can't buy tickets)
3. **Use Eventbrite** (feels like buying car insurance, not attending a concert)

Meanwhile, organizers are:
1. **Paying 5-10% in fees** (Eventbrite + payment processing)
2. **Using 5 different tools** (tickets, marketing, email, analytics, chat)
3. **Building audiences on rented land** (Instagram owns your followers)

### **The Vision**
What if event discovery felt like TikTok (addictive, personalized, social) but you could actually **buy tickets** without leaving the app? And organizers could **build real audiences** (followers, not email lists) with **transparent tools** they actually enjoy using?

That's Liventix.

### **Why Now?**
- **Gen Z expects feed-based discovery** (they don't "search" for events)
- **Organizers are tired of Eventbrite** (high fees, bad UX, no community tools)
- **Tech is ready** (Stripe, Supabase, Capacitor make this buildable by small teams)

---

## 11. Target Use Cases (For Case Studies & Testimonials)

### **Music Venues & Promoters**
*Example: Small music venue (200-500 capacity) hosting 10-20 shows/month*

**Before Liventix:**
- Listed on Eventbrite, paid 5% fees
- Promoted on Instagram, sent followers to external link
- No way to build loyal audience (email list churn)

**With Liventix:**
- 2,000 followers who see every new show
- Lower fees = more $ per show
- Attendees discover venue organically through feed

---

### **Food & Drink Events**
*Example: Monthly food truck festival, farmers market, wine tasting*

**Before Liventix:**
- Free events (no ticketing)
- Hard to gauge turnout (no RSVP tracking)
- No sponsorship opportunities

**With Liventix:**
- Free RSVP tickets (track attendance without charging)
- Sponsored posts from local breweries/brands
- Data on who's attending (for future targeting)

---

### **Community & Networking**
*Example: Tech meetup, fitness class, yoga in the park*

**Before Liventix:**
- Eventbrite for RSVPs (overkill for free events)
- Meetup.com (outdated, no mobile app)
- No follow-up after event

**With Liventix:**
- Simple RSVP flow (no payment)
- Post-event content (recap videos, photos)
- Attendees follow organizer for future events

---

### **Sports & Fitness**
*Example: 5K race, CrossFit competition, pickup basketball league*

**Before Liventix:**
- Custom registration forms (Google Forms, Typeform)
- Manual check-in (clipboards, paper lists)
- No way to share results/photos

**With Liventix:**
- Registration = ticket purchase
- QR code check-in (phone scanner)
- Post-event leaderboard & photos in feed

---

## 12. Key Messages (For Press Releases, Investor Decks, Landing Pages)

### **1-Sentence Pitch**
"Liventix is TikTok for events—personalized discovery meets seamless ticketing."

### **3-Sentence Pitch**
"Liventix reimagines event discovery with a personalized, social feed that shows you events you'll love—not a boring search list. Buy tickets in-app with transparent pricing, follow organizers, and build a passport of experiences. For organizers, it's Eventbrite without the fees, with Instagram's audience-building built in."

### **Problem Statement**
"Event discovery is broken: Google search is SEO spam, Instagram can't sell tickets, and Eventbrite feels like filing taxes. Meanwhile, organizers pay 5-10% in fees and use five different tools to run a single event."

### **Solution Statement**
"Liventix combines Netflix's recommendation engine, Instagram's social feed, and Eventbrite's ticketing into one mobile-first platform. Attendees discover events they'll love; organizers build loyal audiences and sell tickets—all in one app."

### **Traction**
"500+ beta users, 100+ live events, 5,000+ tickets sold. Growing 40% month-over-month."

---

## 13. FAQs (Anticipated Questions)

### **Product Questions**

**Q: Is Liventix free?**  
A: For beta users, yes—100% free with lifetime discounts. After public launch, attendees never pay fees (organizers pay a small platform fee, lower than Eventbrite).

**Q: What types of events can I host?**  
A: Any in-person event: concerts, festivals, sports, food & drink, networking, community gatherings, classes, workshops, etc.

**Q: Do I need a smartphone to use Liventix?**  
A: The mobile experience is best, but you can also use Liventix on desktop browsers. Tickets work on any device.

**Q: Can I scan tickets offline?**  
A: Not yet—offline mode is coming Q2 2025. For now, you need an internet connection to scan.

**Q: Do you integrate with Eventbrite/Ticketmaster?**  
A: Not currently. Liventix is a standalone platform. We offer migration tools to import your past events and attendees.

---

### **Business Questions**

**Q: How do you make money?**  
A: We charge organizers a small platform fee (2.5% vs. Eventbrite's 3.5%) on paid tickets. Free events are always free. Sponsorship marketplace takes a 10% commission.

**Q: What's your competitive advantage vs. Eventbrite?**  
A: Lower fees, better UX, social features, personalized discovery, transparent pricing, and mobile-first design. Eventbrite is stuck in 2010; we're building for Gen Z.

**Q: Who are your investors?**  
A: Currently bootstrapped/angel-backed. (Update this if you raise funding.)

**Q: Are you hiring?**  
A: Not yet, but we're building a waitlist for future roles. Email careers@liventix.com. (Update this when ready.)

---

## 14. Assets & Links (For Marketing Team)

### **Brand Assets**
- **Logo:** `/images/liventix-logo-full.png` (SVG version: request from design team)
- **Colors:** See Section 6 (Brand, Visual Identity & Tone)
- **Fonts:** Inter (Google Fonts), SF Pro Display (Apple), Roboto (Android)

### **Screenshots** (Request from design team)
- Feed (mobile)
- Event detail page (mobile + desktop)
- Ticket checkout flow (3-step)
- Organizer dashboard (analytics)
- Scanner interface
- Profile page (with ticket collection)

### **Demo Videos** (To Be Created)
- 30-second product overview
- 60-second organizer walkthrough
- 90-second attendee journey (discover → buy → attend → share)

### **Website & Social**
- **Website:** [Insert URL when live]
- **Twitter/X:** @Liventix (register if available)
- **Instagram:** @Liventix (register if available)
- **LinkedIn:** Liventix (create company page)
- **TikTok:** @Liventix (register for future content)

---

## 15. Contact & Escalation

### **Press Inquiries**
- **Email:** press@liventix.com (set up forwarding)
- **Response Time:** Within 24 hours

### **Partnership Inquiries**
- **Email:** partnerships@liventix.com
- **Examples:** Venues, festivals, sponsors, payment providers, analytics platforms

### **Beta Access Requests**
- **Email:** beta@liventix.com
- **Form:** [Insert Typeform/Tally link]

### **General Support**
- **Email:** support@liventix.com
- **In-app chat:** (Coming Q1 2025)

---

## 16. Internal Notes (For Marketing Team Only)

### **What to Emphasize**
✅ Mobile-first (we're not a desktop-first platform bolted to mobile)  
✅ Social discovery (TikTok for events, not Google search)  
✅ Transparent pricing (no hidden fees—we show organizers net revenue)  
✅ Community building (followers > email lists)  
✅ Data-driven (analytics that actually help you sell more tickets)

### **What to De-Emphasize**
❌ "Enterprise-grade" (sounds corporate)  
❌ "Blockchain" or "Web3" (we're not crypto)  
❌ "AI-powered" as main pitch (it's a feature, not the product)  
❌ "Disrupting Eventbrite" (acknowledge them, don't make it personal)

### **Competitive Intel**
- **Eventbrite:** Market leader but stagnant (no major updates since 2018)
- **Dice/Tixr:** Music-focused, not social
- **Posh/Fever:** Curated events, not open platform
- **Instagram/TikTok:** Great for discovery, terrible for ticketing

### **Risks & Objections**
- **"Why not just use Instagram + Eventbrite?"** → Fragmented UX, lost conversions, no data portability
- **"Isn't this just a feature, not a company?"** → Network effects = defensible (organizers bring attendees, attendees bring organizers)
- **"Eventbrite has 10M+ events, you have 100."** → We're focused on quality over quantity (and growing fast)

---

## 17. Appendix: Deep Dives (For Technical Audiences)

### **Recommendation Algorithm Details**
See `LIVENTIX_VS_TIKTOK_RECOMMENDATION_COMPARISON.md` and `FEED_INTELLIGENCE_OPTIMIZATION_FOR_TICKETS.md` for full technical breakdown.

**Summary:**
- **Collaborative filtering:** "Users like you also attended..."
- **Content-based:** "Events similar to ones you liked..."
- **Time-decay:** Upcoming events beat far-future ones
- **Exploration bonus:** 10% randomness to avoid filter bubbles
- **Purchase intent tracking:** Did you view tickets? Save event? How long did you linger?

### **Database Architecture**
- **11 domain schemas:** `users`, `events`, `ticketing`, `organizations`, `sponsorship`, `analytics`, etc.
- **~150 tables** with proper foreign keys, indexes, triggers
- **Row Level Security (RLS):** Every query respects user permissions at database level
- **Real-time subscriptions:** WebSocket connections for live updates
- **Edge functions:** 30+ Deno serverless functions for business logic

### **Sponsorship System**
- **AI matching:** Bayesian scoring (budget fit + audience overlap + geo fit + engagement quality)
- **Proposal workflow:** 7-stage funnel (discovery → offer → negotiation → deal → activation → tracking → payout)
- **Escrow:** Automated payouts when deliverables met (impression goals, engagement thresholds)
- **ROI tracking:** Sponsor dashboard with CPM, CTR, conversions

---

## 📝 Changelog

**January 2025:**
- Initial document created
- Added full feature list, competitive analysis, brand guidelines
- Documented beta status, roadmap, constraints

**[Future updates go here]**

---

## ✅ Final Checklist (Before Sharing with Marketing)

- [ ] Update beta user count (currently 500+)
- [ ] Add website URL when live
- [ ] Register social media handles (@Liventix)
- [ ] Create demo video (30-second product overview)
- [ ] Take screenshots of key screens (feed, checkout, dashboard)
- [ ] Set up email addresses (press@, partnerships@, beta@, support@)
- [ ] Add founder bios (if using for PR)
- [ ] Finalize pricing (currently "TBD")
- [ ] Get legal review on competitive claims (before press release)

---

**End of Document**  
*For questions or updates, contact [Your Name] at [Your Email]*


