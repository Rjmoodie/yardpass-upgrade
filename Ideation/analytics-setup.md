# Analytics Setup Specification

## Purpose
Track user behavior, measure conversion rates, and make data-driven decisions for product improvement.

## Recommended Platform
**PostHog** (preferred) or Mixpanel

### Why PostHog?
- Open source option available
- Powerful feature flags
- Session recordings
- User paths visualization
- Self-hosted option for data privacy
- Built-in A/B testing

## Core Metrics to Track

### Acquisition Metrics
- **Unique visitors** to each page
- **Traffic sources** (organic, social, direct, referral)
- **Landing page bounce rate**
- **Signup conversion rate** (visitors → waitlist signups)

### Engagement Metrics
- **Email open rates** by campaign
- **Email click-through rates**
- **Feedback submissions** per user
- **Feedback upvotes** given
- **Time on site** by page
- **Pages per session**

### Retention Metrics
- **7-day return rate**
- **30-day return rate**
- **Email engagement over time**
- **Beta tester activation rate**
- **Beta tester retention** (Day 1, Day 7, Day 30)

### Conversion Funnel
```
Landing Page View
    ↓
Waitlist CTA Click
    ↓
Form Started
    ↓
Form Submitted
    ↓
Email Confirmed
    ↓
Feedback Given
    ↓
Beta Invitation
    ↓
Beta Activated
```

## Event Tracking Schema

### Page Views
```javascript
{
  event: "page_view",
  properties: {
    page_name: string,
    referrer: string,
    utm_source: string,
    utm_medium: string,
    utm_campaign: string
  }
}
```

### Waitlist Signup
```javascript
{
  event: "waitlist_signup",
  properties: {
    email: string,
    organization_type: string,
    source_page: string
  }
}
```

### Feedback Submitted
```javascript
{
  event: "feedback_submitted",
  properties: {
    feedback_type: string, // bug, feature, improvement
    category: string,
    upvotes: number
  }
}
```

### Email Events
```javascript
{
  event: "email_opened" | "email_clicked" | "email_unsubscribed",
  properties: {
    campaign_name: string,
    email_subject: string,
    link_url: string // for clicks
  }
}
```

## Dashboard Requirements

### Main Dashboard
- **Top-level KPIs**: Total signups, conversion rate, active beta users
- **Growth chart**: Daily/weekly signups over time
- **Traffic sources**: Pie chart of acquisition channels
- **Conversion funnel**: Visual funnel with drop-off rates

### User Insights Dashboard
- **User cohorts**: Group by signup date, organization type
- **Retention curves**: Retention by cohort over time
- **Feature usage**: Most popular features in beta
- **Session recordings**: Watch actual user interactions

### Email Performance Dashboard
- **Campaign comparison**: Side-by-side metrics for all campaigns
- **Best performing emails**: Sorted by open rate, CTR
- **Unsubscribe trends**: Track and investigate spikes

## Implementation Checklist
- [ ] Install PostHog script in `<head>` of all pages
- [ ] Set up custom events for all key user actions
- [ ] Create user properties (email, signup_date, org_type)
- [ ] Enable session recordings
- [ ] Set up conversion funnels
- [ ] Create retention charts
- [ ] Configure email tracking (via webhook or integration)
- [ ] Set up alerts for critical metrics (e.g., conversion rate drops)
- [ ] Create weekly analytics review dashboard

## Privacy & Compliance
- Display cookie consent banner
- Link to privacy policy from all forms
- Allow users to opt-out of tracking
- Anonymize IP addresses
- Comply with GDPR, CCPA requirements

## Launch Decision Criteria
**Do NOT launch publicly until:**
- 7-day retention rate > 40%
- 30-day retention rate > 20%
- Beta NPS score > 30
- Critical bugs < 3 per week
- Average session time > 3 minutes