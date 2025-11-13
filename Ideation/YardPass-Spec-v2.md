# Liventix Platform Specification (v2.0)

## Core Specification (recap)
See v1.0 spec for base functionality including:
- User auth via phone number
- Attendee vs Organizer toggle
- Attendee flow (video-first, TikTok-style feed, ticket purchase, post + interactions)
- Organizer flow (org onboarding, dashboards, team roles, analytics, event creation & management)
- Ticket tiering & attendee badges
- Payment integration (Stripe/Alt)
- Role-based access control
- Cultural guide in event creation

---

## Advanced Features (v2.0)

### 1. Fraud Prevention & Ticket Security
- **QR Codes**: Dynamically generated per ticket, validated server-side at check-in.
- **One-time Scan**: QR invalidates after first successful scan.
- **Device Binding**: Option to bind tickets to the purchaser’s device/account for extra security.
- **Spec Intelligence**: Implement via Supabase Row Level Security (RLS) + edge functions.

### 2. Ticket Resale & Transfer
- **Resale Marketplace**: Attendees can list tickets for resale at organizer-approved prices.
- **Transfer Option**: Attendees can transfer tickets to friends (name/email/phone binding).
- **Organizer Control**: Toggle resale allowed, set floor/ceiling prices.

### 3. Waitlists
- **Auto Waitlist**: If event sells out, users can join a waitlist.
- **Auto Promotion**: If tickets free up (refund or resale), waitlisted users auto-notified.
- **Priority Rules**: Organizers can set priority tiers (e.g., VIP waitlist).

### 4. Affiliate / Promoter Tracking
- **Promoter Links**: Organizers generate affiliate links.
- **Analytics**: Track sales, clicks, and conversion rates per promoter.
- **Commissioning**: Option to assign % of sales to promoters, payable via Stripe Connect.

### 5. Push Notifications & Engagement
- **Transactional**: Purchase confirmation, ticket delivery, event reminders.
- **Marketing**: New event drops, organizer announcements, recommended events.
- **Engagement**: Post likes/comments, follow organizer updates.

### 6. Enhanced Analytics & AI Insights
- **Organizer Dashboard**: 
  - Ticket sales breakdown by tier, channel, and geography.
  - Engagement insights (views, shares, watch time from video feed).
- **Promoter Analytics**: Track promoter effectiveness.
- **Attendee Analytics**: Past event history, badges earned, engagement score.
- **AI Add-on**: Predictive attendance, pricing suggestions, engagement optimization.

### 7. Refunds & Policies
- **Refund Rules**: Organizers define (e.g., refundable up to 7 days before).
- **Automation**: Stripe integration handles refund flow automatically.
- **No Refund Badge**: Ticket tiers can be marked non-refundable.

### 8. Identity & Verification
- **User Verification**: All users authenticate with phone + optional 2FA.
- **Organizer Verification**:
  - Tier 1: Phone + 2FA
  - Tier 2: Stripe onboarding + org verification (badge + pro tools)
- **Badge System**:
  - Attendee: Ticket-tier based (event-specific)
  - Organizer: Verified/Pro badges
  - Promoter: Affiliate badge

### 9. Scanning & Check-In
- **Organizer Role "Scanner"**: Can only access scanning interface.
- **Multi-device Support**: Multiple check-in devices sync in real time.
- **Offline Mode**: Tickets cache locally for areas with bad internet.

---

## Next Steps
- Database schema updates (tables for resale, waitlist, promoter tracking)
- Edge functions for resale, transfer, fraud detection, affiliate analytics
- Push notification service integration (Expo, Firebase, or OneSignal)
- Expanded dashboard UI for analytics & management
