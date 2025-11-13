# Stripe Connect Integration Documentation

## Overview
This implementation provides a complete Stripe Connect integration for the Liventix platform, enabling seamless payment processing and payouts for event organizers.

## Architecture

### Core Components

1. **Stripe Express Accounts**: Each organizer gets a Stripe Express connected account
2. **Destination Charges**: Payments are split automatically (platform fee vs organizer revenue)
3. **Webhook Processing**: Real-time account updates and payout notifications
4. **Dashboard Integration**: Unified payout management across individual and organization contexts

## Implementation Details

### Edge Functions

#### `create-stripe-connect`
- Creates Stripe Express accounts for individuals or organizations
- Generates onboarding links for KYC/verification
- Stores account details in `payout_accounts` table

#### `stripe-connect-portal`
- Creates login links to Stripe Express Dashboard
- Allows organizers to manage bank details, tax info, and view payouts

#### `get-stripe-balance`
- Fetches real-time balance data from Stripe
- Returns available and pending amounts for payout requests

#### `create-payout`
- Initiates manual payout requests
- Validates permissions and account status
- Uses Stripe Payouts API with connected accounts

#### `enhanced-checkout`
- Enhanced checkout flow with destination charges
- Automatically splits payments (5% platform fee)
- Routes funds to organizer's connected account

#### `stripe-webhook`
- Handles `account.updated` events for verification status
- Processes `payout.paid` and `payout.failed` events
- Updates database with latest account status

### Frontend Components

#### `StripeConnectOnboarding`
- Complete onboarding experience after organization creation
- Shows account status and verification progress
- Handles re-onboarding for incomplete accounts

#### `PayoutManager`
- Request manual payouts with balance validation
- Real-time balance display (available/pending)
- Input validation and error handling

#### `StripeConnectButton`
- Quick access component for enabling/managing Stripe Connect
- Contextual text based on account status
- Integrates into user profiles and dashboards

#### `PayoutsManager`
- Unified dashboard for managing multiple payout contexts
- Switch between individual and organization accounts
- Comprehensive payout history and analytics

## User Flow

### 1. Organization Creation
```
User creates organization → Success page → Optional Stripe Connect setup
```

### 2. Stripe Connect Onboarding
```
Click "Enable Payouts" → Stripe Express onboarding → Account verification → Ready for payouts
```

### 3. Payment Processing
```
Customer purchases ticket → Destination charge → Automatic split → Funds in organizer account
```

### 4. Payout Management
```
View balance → Request payout → Stripe processes → Funds arrive in bank account
```

## Database Schema

### `payout_accounts`
```sql
- id (uuid, primary key)
- context_type ('individual' | 'organization')
- context_id (uuid, references user or organization)
- stripe_connect_id (text, Stripe account ID)
- charges_enabled (boolean)
- payouts_enabled (boolean)
- details_submitted (boolean)
- created_at (timestamp)
```

## Security & Compliance

### Row Level Security (RLS)
- Users can only access their own payout accounts
- Organization members require appropriate roles
- Webhook endpoints use service role for updates

### Data Protection
- No sensitive financial data stored locally
- KYC/verification handled entirely by Stripe
- Account status synchronized via webhooks

### Access Control
- Individual accounts: owner access only
- Organization accounts: admin/owner role required
- Payout requests: verified account status required

## Configuration

### Webhook Endpoints
Configure in Stripe Dashboard:
- `account.updated`
- `payout.paid`
- `payout.failed`
- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`

### Platform Fee
Currently set to 5% in `enhanced-checkout` function. Configurable per business requirements.

### Payout Schedule
- Manual payouts: On-demand via dashboard
- Automatic payouts: Stripe default (daily for most accounts)

## Error Handling

### Account Setup Errors
- Missing verification: Clear prompts to complete onboarding
- Disabled accounts: Show reason and re-onboarding options
- API failures: Graceful fallbacks with retry mechanisms

### Payout Errors
- Insufficient balance: Real-time validation
- Account restrictions: Clear error messages
- Network issues: Retry logic with exponential backoff

## Testing

### Test Accounts
Use Stripe test mode for development:
- Test Express accounts auto-approve
- Mock payouts for testing flows
- Webhook events can be triggered manually

### Validation Points
- Account creation and onboarding
- Payment flow with destination charges
- Payout requests and processing
- Webhook event handling
- Error scenarios and edge cases

## Deployment

### Environment Variables
Required Stripe secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Edge Function Configuration
All functions configured in `supabase/config.toml` with appropriate JWT verification settings.

## Monitoring

### Webhook Logs
Monitor Edge Function logs for:
- Successful webhook processing
- Failed account updates
- Payout completion/failure events

### Account Health
- Track verification completion rates
- Monitor payout success rates
- Alert on failed webhook processing

## Future Enhancements

### Planned Features
- Automated payout scheduling
- Enhanced analytics dashboard
- Multi-currency support
- Marketplace seller onboarding

### Scalability Considerations
- Batch webhook processing for high volume
- Cached balance queries
- Rate limiting for API calls
- Database optimization for large datasets

This implementation provides a production-ready Stripe Connect integration that scales with the platform's growth while maintaining security and compliance standards.