# Liventix - Live Event Tickets

A premium event ticketing and social platform built with React, TypeScript, and Supabase.

🚀 **iOS Build Ready** - Cloud building configured with GitHub Actions!

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Stripe account (for payments)
- Mapbox account (for location services)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd liventix-upgrade

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# Start development server
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional if your functions are hosted separately; defaults to ${VITE_SUPABASE_URL}/functions/v1
VITE_SUPABASE_FUNCTIONS_URL=

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Mapbox Configuration
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token

# Push Notifications (Optional)
VITE_WEB_PUSH_PUBLIC_KEY=your_vapid_public_key

# Analytics (Optional)
VITE_POSTHOG_KEY=your_posthog_key
VITE_POSTHOG_HOST=https://app.posthog.com
```

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Base UI components (shadcn/ui)
│   └── ...             # Feature components
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
├── pages/              # Page components
├── contexts/           # React contexts
├── integrations/       # External service integrations
└── utils/              # Utility functions

supabase/
├── functions/          # Edge functions
├── migrations/         # Database migrations
└── config.toml         # Supabase configuration
```

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
```

### Code Quality

This project uses:
- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Tailwind CSS** for styling
- **Radix UI** for accessible components

### Database

The project uses Supabase with the following key tables:
- `events` - Event information
- `ticket_tiers` - Ticket pricing and availability
- `tickets` - User ticket purchases
- `orders` - Payment orders
- `event_posts` - Social posts for events
- `profiles` - User profiles

## 🚀 Deployment

### Supabase Edge Functions

Deploy edge functions to Supabase:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref yieslxnrfeqchbcmgavz

# Deploy functions
supabase functions deploy
```

### Web App Deployment

The app can be deployed to any static hosting service:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

Build the app:
```bash
npm run build
```

The built files will be in the `dist/` directory.

## 🔧 Configuration

### Supabase Setup

1. Create a new Supabase project
2. Run the migrations in `supabase/migrations/`
3. Set up Row Level Security (RLS) policies
4. Configure edge functions

### Stripe Setup

1. Create a Stripe account
2. Set up webhooks pointing to your Supabase edge functions
3. Configure products and pricing

### Mapbox Setup

1. Create a Mapbox account
2. Generate an access token
3. Add the token to your environment variables

## 🧪 Testing

Run the test suite:

```bash
npm test
```

## 📱 Mobile App

This project includes Capacitor for mobile app deployment:

```bash
# Add mobile platforms
npx cap add ios
npx cap add android

# Build and sync
npm run build
npx cap sync

# Open in native IDEs
npx cap open ios
npx cap open android
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**Build fails with TypeScript errors:**
- Run `npm run type-check` to see specific errors
- Ensure all environment variables are set correctly

**Supabase connection issues:**
- Verify your Supabase URL and keys
- Check that RLS policies are configured correctly

**Stripe payment issues:**
- Ensure webhook endpoints are configured
- Check that Stripe keys are for the correct environment (test/live)

**Mobile app issues:**
- Ensure Capacitor is properly configured
- Check that native permissions are set correctly

### Getting Help

- Check the [Issues](https://github.com/your-repo/issues) page
- Review the [Supabase documentation](https://supabase.com/docs)
- Check the [Stripe documentation](https://stripe.com/docs)