# Liventix Marketing Website - Master Prompt for Lovable

## Project Overview
Build a beautiful, conversion-driven marketing website for Liventix - an event management platform. The site will capture early signups, showcase product value, and prepare for beta launch.

## Required Pages
1. **Landing Page** (`/`) - Main conversion page with hero, features, testimonials, FAQ
2. **Waitlist Page** (`/waitlist`) - Email signup form for early access
3. **Feedback Board** (`/feedback`) - User feedback and roadmap (integrate Canny)
4. **Beta Testing** (`/beta`) - Information and onboarding for beta testers
5. **Privacy Policy** (`/privacy`) - Legal compliance
6. **Terms of Service** (`/terms`) - Legal compliance

## Key Features to Implement
- Responsive design (mobile-first)
- Email signup forms with validation
- PostHog analytics integration
- Smooth animations and transitions
- Fast loading (< 2s)
- SEO-optimized meta tags
- Accessible (WCAG 2.1 AA)

## Design Requirements
- **Colors**: Primary Indigo (#6366F1), Secondary Pink (#EC4899)
- **Typography**: Inter font family from Google Fonts
- **Components**: Use Shadcn/ui components
- **Style**: Modern, clean, professional with friendly tone

## Integrations Needed
1. **FormSpark**: For collecting emails
2. **PostHog**: For analytics tracking
3. **Canny**: For feedback board (embed iframe)
4. **Loops/Customer.io**: For email automation (webhook setup)

## Success Metrics
- Waitlist signup conversion rate > 15%
- Page load time < 2s
- Mobile responsive on all devices
- Lighthouse score > 90

## Detailed Specifications
Read these MD files for complete details:
- `marketing-site-overview.md` - Project structure
- `landing-page.md` - Landing page sections and content
- `waitlist-page.md` - Signup form specifications
- `feedback-board.md` - Feedback system details
- `beta-testing-page.md` - Beta onboarding flow
- `email-system.md` - Email automation flows
- `analytics-setup.md` - Tracking requirements
- `design-guidelines.md` - Visual design system
- `technical-stack.md` - Tech stack details

## Implementation Order
1. Set up project with React + TypeScript + Tailwind
2. Create landing page with hero and features
3. Build waitlist signup form
4. Integrate PostHog analytics
5. Add feedback board integration
6. Create beta testing page
7. Polish design and optimize performance
8. Add privacy/terms pages
9. Final QA and launch

## Notes
- Focus on conversion optimization
- Use persuasive, clear copy
- Ensure fast load times
- Make it mobile-friendly first
- Track everything with analytics