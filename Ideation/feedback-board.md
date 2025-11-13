# Feedback Board Specification

## Purpose
Collect, organize, and prioritize user feedback to guide product development and build community engagement.

## Recommended Platform
**Canny** (preferred) or similar feedback board tool

### Why Canny?
- Beautiful, customizable UI
- Upvoting system
- Automatic duplicate detection
- Roadmap integration
- Email notifications
- Private boards for beta
- Public boards for post-launch

## Page URL
`/feedback` or `/roadmap`

## User Experience Flow

### 1. Landing on Feedback Board
**Header Section:**
- Title: "Help Shape Liventix"
- Subtitle: "Your feedback drives our roadmap. Vote on features, report bugs, and share ideas."
- Search bar: "Search existing feedback..."
- CTA: "Submit New Feedback" (prominent button)

### 2. Viewing Feedback
**Sorting Options:**
- Trending (default)
- Most votes
- Recent
- Under review
- Planned
- In progress
- Completed

**Filter by Category:**
- Features
- Improvements
- Bugs
- Mobile App
- Web Platform
- Integrations
- Analytics

**Each Feedback Card Shows:**
- Title
- Description preview (first 100 chars)
- Upvote count (clickable)
- Status badge (New, Under Review, Planned, etc.)
- Number of comments
- Category tag
- Submitter name/avatar (if public)

### 3. Submitting Feedback
**Form Fields:**
- **Title** (required, max 100 chars)
  - Placeholder: "Describe your idea in one sentence"
- **Description** (required, rich text editor)
  - Placeholder: "Provide details, use cases, or steps to reproduce"
  - Support for:
    - Text formatting (bold, italic, lists)
    - Screenshots (drag & drop)
    - Links
- **Category** (required, dropdown)
- **Email** (auto-filled if logged in)
- **Notify me of updates** (checkbox, default: checked)

**Submission Flow:**
1. User fills form
2. System checks for duplicates (show similar posts)
3. User confirms submission or merges with existing
4. Success message + link to track their feedback
5. Email confirmation sent

### 4. Interacting with Feedback
**Users Can:**
- Upvote (one vote per user, can undo)
- Comment and reply
- Follow for updates
- Share feedback link

**Admin/Team Can:**
- Change status
- Add internal notes
- Merge duplicates
- Mark as roadmap item
- Close or archive

## Status Workflow

```
New Submission
    ↓
Under Review (team reviews)
    ↓
    ├─→ Not Planned (with explanation)
    ├─→ Duplicate (merge)
    └─→ Planned (add to roadmap)
            ↓
        In Progress (development started)
            ↓
        Completed (feature launched)
```

## Notification System

### Email Notifications
**User Receives Email When:**
- Their feedback gets upvoted (weekly digest)
- Team changes status of their feedback
- Team comments on their feedback
- Related feature is completed

**Team Receives Email When:**
- New high-priority feedback submitted
- Feedback reaches upvote threshold (e.g., 10, 25, 50)
- User mentions team member

### In-App Notifications
- Bell icon with unread count
- Notification feed showing recent updates
- Direct links to relevant feedback

## Gamification Elements

### Badges for Active Users
- **First Feedback**: Submit your first idea
- **Top Voter**: Upvote 25+ items
- **Community Leader**: Get 50+ upvotes on your feedback
- **Beta Hero**: Submit 10+ items during beta

### Leaderboard
- Top contributors (by upvotes received)
- Most active voters
- Most helpful commenters

## Roadmap Integration

### Public Roadmap View
**Sections:**
- **Now** (In Progress)
- **Next** (Planned)
- **Later** (Under Consideration)

**Each Roadmap Item Shows:**
- Feature name
- Description
- Linked feedback posts
- Estimated quarter (if available)
- Progress indicator

## Analytics to Track
- Feedback submissions per week
- Average upvotes per feedback item
- Time from submission to "Planned" status
- Completion rate of planned features
- User engagement (comments, votes)
- Most active users

## Design Requirements
- Match Liventix brand colors and typography
- Mobile-responsive (optimized for phone voting)
- Quick upvote interaction (single click/tap)
- Clear visual hierarchy
- Loading states for async actions
- Optimistic UI updates (instant feedback)

## Integration Points
- **Email System**: Sync with email platform for notifications
- **Analytics**: Track engagement metrics
- **CRM**: Tag users by feedback activity
- **Slack**: Alert team channel for new high-priority feedback

## Moderation Guidelines
- Auto-flag profanity or spam
- Team approves first-time submissions
- Ban abusive users
- Keep tone positive and constructive in responses

## Launch Checklist
- [ ] Set up Canny board with Liventix branding
- [ ] Create initial categories
- [ ] Configure status workflow
- [ ] Set up email notifications
- [ ] Integrate with PostHog
- [ ] Seed with 5-10 sample feedback items
- [ ] Test full submission → completion flow
- [ ] Add feedback link to website footer
- [ ] Promote feedback board in welcome email