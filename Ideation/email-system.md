# Email System Specification

## Purpose
Automate user communication, drive engagement, and guide users through the YardPass journey from waitlist to active beta user.

## Recommended Platform
**Loops** (preferred), Customer.io, or Mailchimp

### Why Loops?
- Built for SaaS workflows
- Easy visual automation builder
- Transactional + marketing in one
- Clean, modern email templates
- Good deliverability
- Generous free tier

## Email Architecture

### Transactional Emails
System-triggered, time-sensitive messages

### Marketing Emails  
Promotional, educational, engagement-focused

## Email Flows & Sequences

### 1. Waitlist Welcome Flow

**Email 1: Immediate Confirmation** (Transactional)
- **Trigger**: Form submission
- **Timing**: Within 1 minute
- **Subject**: "Welcome to YardPass! 🎪 You're on the list"
- **Content**:
  - Warm welcome
  - Confirmation of signup
  - What to expect next
  - Timeline estimate (e.g., "Beta starts in 6-8 weeks")
  - CTA: "Explore the roadmap" → Link to feedback board
  - Social media follow links
  - Quick survey: "What's your #1 event management challenge?" (1-click answers)

**Email 2: Behind the Scenes** (Marketing)
- **Trigger**: 3 days after signup
- **Subject**: "The story behind YardPass"
- **Content**:
  - Founder story / mission
  - Problems YardPass solves
  - Sneak peek at key features
  - CTA: "Vote on features" → Feedback board

**Email 3: Feature Spotlight** (Marketing)
- **Trigger**: 7 days after signup
- **Subject**: "How YardPass handles [Problem X]"
- **Content**:
  - Deep dive into one core feature
  - Screenshots or short demo video
  - Real-world use case
  - CTA: "See the full roadmap"

**Email 4: Beta Prep** (Marketing)
- **Trigger**: 2 weeks before beta launch (manual trigger)
- **Subject**: "You're in! Beta access starts next week 🚀"
- **Content**:
  - Beta launch date
  - What to expect
  - How to get the most out of beta
  - TestFlight instructions (if mobile)
  - Beta perks: "Lifetime discount," "Early adopter badge," etc.

### 2. Beta User Flow

**Email 1: Beta Invitation** (Transactional)
- **Trigger**: User granted beta access
- **Subject**: "Your YardPass beta access is ready!"
- **Content**:
  - Congratulations
  - TestFlight link or web app login
  - Quick start guide (3-5 key steps)
  - Support contact info
  - CTA: "Start exploring YardPass"

**Email 2: Onboarding Day 1** (Transactional)
- **Trigger**: 24 hours after first login
- **Subject**: "Make the most of YardPass (Quick tips)"
- **Content**:
  - Congratulate first login
  - Top 3 features to try first
  - Short video tutorials
  - CTA: "Create your first event" or "Explore analytics"

**Email 3: Feature Discovery** (Marketing)
- **Trigger**: 3 days after first login
- **Subject**: "You might have missed this..."
- **Content**:
  - Highlight less obvious but powerful features
  - User success story or testimonial
  - CTA: "See what's possible"

**Email 4: Engagement Check** (Marketing)
- **Trigger**: 7 days after first login
- **Subject**: "How's your YardPass experience so far?"
- **Content**:
  - Ask for feedback
  - Link to feedback board
  - NPS survey (1-10 scale)
  - CTA: "Share your thoughts"

### 3. Re-engagement Flow (for inactive users)

**Email 1: We Miss You** (Marketing)
- **Trigger**: 14 days of inactivity (no login)
- **Subject**: "Did you forget about us? 😢"
- **Content**:
  - Friendly reminder
  - New features added since last visit
  - CTA: "Log back in"

**Email 2: What's New** (Marketing)
- **Trigger**: 7 days after Email 1 if still inactive
- **Subject**: "Here's what you're missing"
- **Content**:
  - Changelog highlights
  - User wins / case studies
  - Limited-time beta perk (if applicable)
  - CTA: "Reactivate your account"

**Email 3: Final Check-in** (Marketing)
- **Trigger**: 7 days after Email 2 if still inactive
- **Subject**: "We'd love your feedback before you go"
- **Content**:
  - Ask why they stopped using YardPass
  - Exit survey (keep it short, 3 questions max)
  - Option to pause emails
  - CTA: "Help us improve"

### 4. Feedback & Feature Updates

**Email: Feature Request Update** (Transactional)
- **Trigger**: User's upvoted feature moves to "Planned" or "Completed"
- **Subject**: "Great news! [Feature] is now [status]"
- **Content**:
  - Status update
  - Timeline (if planned)
  - How to try it (if completed)
  - CTA: "See it in action"

**Email: Weekly Digest** (Marketing, optional)
- **Trigger**: Every Friday (for engaged users only)
- **Subject**: "Your weekly YardPass update"
- **Content**:
  - Top voted feedback this week
  - New features shipped
  - Community highlight (user story)
  - CTA: "View the full changelog"

### 5. Promotional & Announcements

**Email: Public Launch** (Marketing)
- **Trigger**: Manual send when exiting beta
- **Subject**: "YardPass is officially live! 🎉"
- **Content**:
  - Celebrate launch
  - Thank beta testers
  - Special offer for early supporters
  - CTA: "Invite your team"

**Email: New Plan Tier** (Marketing)
- **Trigger**: Manual send when new pricing tier launches
- **Subject**: "Introducing [Plan Name]"
- **Content**:
  - New plan features
  - Who it's for
  - Pricing
  - Limited-time launch discount
  - CTA: "Upgrade now"

## Email Design Guidelines

### Template Structure
- **Header**: YardPass logo, centered
- **Hero Section**: Eye-catching headline with optional image
- **Body**: Clear, scannable text (short paragraphs, bullet points)
- **CTA**: Single, prominent button
- **Footer**: Unsubscribe, social links, address

### Design Principles
- **Mobile-first**: 60%+ of opens are mobile
- **Single column**: Easier to read and code
- **High contrast**: Ensure readability
- **Brand colors**: Use YardPass palette
- **Minimal images**: Reduce load time, avoid spam filters
- **Plain text version**: Always include for deliverability

### Tone & Voice
- **Friendly but professional**
- **Conversational** (use "you" and "we")
- **Action-oriented** (clear next steps)
- **Concise** (respect user's time)
- **Positive** (even in re-engagement emails)

## Personalization Tokens

```
{{first_name}}
{{email}}
{{organization_type}}
{{signup_date}}
{{days_since_signup}}
{{features_voted_on}}
{{last_login_date}}
{{events_created}} (for beta users)
```

## A/B Testing Plan

### Test Variables
- Subject lines (short vs. long, emoji vs. no emoji)
- CTA button text and color
- Email length (concise vs. detailed)
- Send time (morning vs. evening)
- Frequency (daily tips vs. weekly digest)

### Success Metrics
- Open rate (industry avg: 20-25% for SaaS)
- Click-through rate (industry avg: 2-5%)
- Unsubscribe rate (keep < 0.5%)
- Conversion rate (e.g., email → login)

## Unsubscribe & Preference Center

### Unsubscribe Options
- Unsubscribe from all marketing emails (keep transactional)
- Unsubscribe from all emails
- Pause emails for 30 days

### Preference Center
Allow users to choose:
- **Email types**: Product updates, tips, promotions
- **Frequency**: Weekly digest, real-time, monthly
- **Topics**: Analytics features, mobile updates, integrations

## Deliverability Best Practices
- Use authenticated domain (SPF, DKIM, DMARC)
- Avoid spam trigger words ("FREE!", "Act now!")
- Maintain healthy list (remove hard bounces)
- Monitor sender reputation
- Warm up sending domain gradually

## Integration Points
- **Form submissions**: Auto-add to waitlist flow
- **Beta activation**: Trigger beta welcome email
- **Feedback board**: Notify on status changes
- **Analytics**: Track email performance in PostHog
- **CRM**: Sync email engagement data

## Compliance
- **GDPR**: Explicit consent, easy opt-out
- **CAN-SPAM**: Physical address in footer, clear sender info
- **CCPA**: Honor "Do Not Sell" requests
- **Double opt-in**: Confirm email on signup (recommended)

## Launch Checklist
- [ ] Set up Loops account and custom domain
- [ ] Design and code email templates
- [ ] Create all email flows (6 sequences listed above)
- [ ] Set up personalization tokens
- [ ] Configure sending schedule
- [ ] Test all links and CTAs
- [ ] Send test emails to team
- [ ] Set up analytics tracking
- [ ] Create unsubscribe page
- [ ] Add legal compliance (footer address, etc.)
- [ ] Schedule first campaign (waitlist welcome)