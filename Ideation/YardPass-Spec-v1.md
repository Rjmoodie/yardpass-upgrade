# Liventix Specification Document

This document outlines the current product policies, flows, and structures for Liventix.  
It is written in Markdown format for portability (can be imported into Notion, GitHub, or any Markdown editor).

---

## 1. User Roles & Authentication

### Authentication
- Users authenticate with **phone number only** (fast, TikTok-style entry).  
- Optional OAuth (Google/Apple) may be added later.

### Roles
- **Attendee** (default): browse events, interact with posts, buy tickets.  
- **Organizer**: can create/manage events, dashboards, analytics.  
- **Role Toggle**: users can switch between attendee view and organizer view with a toggle.

---

## 2. Account Types

- **Individual**  
  - Can create/manage events under personal identity.  
  - Verified through phone + 2FA.  

- **Organization**  
  - Requires **onboarding** before accessing org dashboards.  
  - Can invite team members with roles: admin, editor, scanner.  
  - Business verification required for payouts (Stripe Connect).  

---

## 3. Event Flow

1. **Event Creation Wizard**
   - Basics (title, description, category, cover image).  
   - Schedule & Location.  
   - Tickets & Access (multiple tiers, free/paid, attendee badge assignment).  
   - Cultural Guide (optional context for cultural/historical depth).  
   - Media & Promotion (upload videos via MUX, promos).  
   - Review & Publish.  

2. **Event Management**
   - Edit event.  
   - View guest list.  
   - Scan tickets (/scanner).  
   - Analytics dashboard.  

3. **Ticket Flow**
   - Select tier → Checkout (Stripe) → Payment success.  
   - Ticket confirmation in app + email.  
   - Wallet integration: Apple Wallet (.pkpass), Google Wallet object.  

---

## 4. Content & Engagement

- **Video-First Feed** (powered by MUX or similar):  
  - Event-related posts (short-form video).  
  - Interactions: like, comment, share.  
  - Redirect buttons: to event, to organizer, or to user profile.  

- **Posting Rules**:  
  - Anyone can post to an event feed.  
  - Attendees get a **badge** showing ticket tier next to their username.  

- **Attendee Profile**:  
  - Past & future ticket catalogue.  
  - TikTok-style profile feed of posts tied to events attended.  

---

## 5. Badge System

- Event-specific badges (not global).  
- Badge tied to **ticket tier**.  
- Example: “VIP”, “Early Bird”, “General”.  
- Stored in DB (event_attendee_tiers table) → easier for queries.  

---

## 6. Verification

- **User Verification**:  
  - Phone verification (mandatory).  
  - 2FA recommended for organizers.  

- **Organization Verification**:  
  - Stripe Connect onboarding (for payouts).  
  - Business docs check.  

- **Verification Levels**:  
  - none → pending → verified → pro (after 25 events completed).  

---

## 7. Payments & Payouts

- **Stripe Connect** for payouts (organizer onboarding required).  
- **Take Rate**:  
  - Platform fee modeled after Eventbrite: ~3.7% + $1.79 per ticket.  
  - Weighted average % tracked as "platform fee as % GMV".  
- **Refunds**: Configurable by organizers (default: 7 days before event).  

---

## 8. Analytics

- **Organizer Analytics**:  
  - Ticket sales, revenue, refunds.  
  - Engagement data (views, shares, comments).  
  - Affiliate/promoter tracking (via share links).  

- **Attendee Analytics**:  
  - Past tickets, attended events, badges earned.  

- **AI Insights** (future): predictive sales, engagement heatmaps.  

---

## 9. Additional Considerations

- **Universal Search**: filter by category, date, location.  
- **SMS & Email Marketing**: integrated into organizer dashboard.  
- **Scanner Role**: assigned per event for door check-in.  
- **Privacy & Legal**: privacy policy, terms of service, refund policy pages required.  

---

## 10. Growth & Tiering

- **Free entry** for all creators → encourages more events.  
- **Tier 1 tools**: unlocked with phone + 2FA.  
- **Tier 2 tools**: unlocked for organizations after business verification & 25 completed events.  
- Badge upgrade: "Verified Pro".  

---

*End of Liventix Spec*
