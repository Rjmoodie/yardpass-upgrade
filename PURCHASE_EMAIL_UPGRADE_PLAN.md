# Purchase Confirmation Email Upgrade Plan

## Overview
Upgrading the purchase confirmation email template to match the provided spec exactly, with PDF-first approach and Ticketmaster-level polish.

## Key Changes Required

### 1. Section Order (MUST FOLLOW EXACTLY)
1. **Confirmation Hero (PDF-first)** - Primary CTA: Download Ticket PDF, Secondary: View Tickets Online
2. **Personalized Greeting** - "Hi {{user_first_name}} 👋"
3. **Event Snapshot Card** - Event image + key details with calendar link
4. **About the Event** (Optional, short description)
5. **Ticket & Order Summary** - Ticket type, quantity, total, order ID
6. **How to Use Your Tickets** - 3-4 step PDF flow instructions
7. **Important Event Info** - Doors, showtime, entry requirements, etc.
8. **Helpful Tips** - Bullet list with marketing-style copy
9. **Support & Footer** - Contact, links, optional app badges

### 2. Brand Colors
- Primary: #007bff (Liventix blue) or existing #03A9F4
- Accent: Subtle grays for cards
- System fonts: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto

### 3. PDF-First Approach
- Primary CTA: "Download Ticket PDF" button (large, prominent)
- Secondary CTA: "View Tickets Online" (outline/lighter style)
- Both buttons stacked on mobile

### 4. New Variables Needed
- `ticket_pdf_url` - Direct download link for PDF
- `online_ticket_portal_url` - Link to online ticket viewer
- `event_date_human` - "Friday, December 15, 2024"
- `event_time_human` - "7:00 PM"
- `event_timezone` - "EST"
- `doors_time_human` - Optional
- `show_time_human` - Optional
- `age_restriction` - Optional
- `entry_requirements` - Optional
- `will_call_policy` - Optional
- `seat_section`, `seat_row`, `seat_range` - Optional (if seated)
- `payment_method_masked` - Optional
- `calendar_url` - Google Calendar link
- `ticket_transfer_url` - Link to transfer tickets

### 5. Mobile-First Design
- Max width: 600px
- Single column layout
- Full-width buttons on mobile
- Clear tap areas (min 44px)
- Inline styles only (email-safe)

## Implementation Notes

1. Keep PDF attachment functionality (already working)
2. Add PDF download URL generation or pass as parameter
3. Update BaseEmailLayout header to include "View in browser" link
4. Follow spec section order exactly
5. Hide sections when data is null/empty
6. Use human-readable date/time formatting
7. Add calendar link generation

## Next Steps

1. ✅ Update template function signature to accept new URLs
2. ⏳ Replace template body with spec-compliant structure
3. ⏳ Add date/time formatting helpers
4. ⏳ Add calendar URL generation
5. ⏳ Update handler to pass PDF URL and portal URL
6. ⏳ Test email rendering
7. ⏳ Deploy and verify



