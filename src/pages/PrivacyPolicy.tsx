import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1>Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8 text-sm">
          <p className="font-semibold">
            YardPass, Inc. ("YardPass," "we," "us," or "our") is committed to protecting your privacy. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
            when you use our event ticketing and social platform.
          </p>

          <section>
            <h2 className="text-lg font-semibold mb-3">1. Information We Collect</h2>
            
            <h3 className="text-base font-semibold mb-2 mt-4">1.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong>Account Information:</strong> Name, email, phone, password, profile photo, social links</li>
              <li><strong>Payment Information:</strong> Credit card details, billing address (via Stripe)</li>
              <li><strong>Event Information:</strong> Event details, descriptions, locations, pricing, media</li>
              <li><strong>User Content:</strong> Posts, comments, reactions, photos, videos, messages</li>
              <li><strong>Organization Data:</strong> Organization names, logos, verification documents, team info</li>
            </ul>

            <h3 className="text-base font-semibold mb-2 mt-4">1.2 Automatically Collected</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong>Usage Data:</strong> Pages viewed, time spent, clicks, video views, engagement</li>
              <li><strong>Device Info:</strong> IP address, browser, OS, device identifiers</li>
              <li><strong>Location:</strong> Approximate location via IP; precise if granted</li>
              <li><strong>Tracking:</strong> Cookies, pixels for analytics and personalization</li>
            </ul>

            <h3 className="text-base font-semibold mb-2 mt-4">1.3 From Third Parties</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Social media profile data when you connect accounts</li>
              <li>Transaction data from Stripe</li>
              <li>Analytics from PostHog and Mux</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong>Service Delivery:</strong> Process tickets, manage events, facilitate check-ins</li>
              <li><strong>Communications:</strong> Send confirmations, reminders, event updates, notifications</li>
              <li><strong>Personalization:</strong> Recommend events based on interests and activity</li>
              <li><strong>Content:</strong> Host and display posts, videos, event content</li>
              <li><strong>Analytics:</strong> Monitor performance, analyze behavior, improve features</li>
              <li><strong>Security:</strong> Detect fraud, prevent abuse, enforce Terms of Service</li>
              <li><strong>Legal:</strong> Comply with laws, respond to requests, protect rights</li>
              <li><strong>Marketing:</strong> Send promotions with consent (opt-out anytime)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Information Sharing</h2>
            
            <h3 className="text-base font-semibold mb-2 mt-4">3.1 With Event Organizers</h3>
            <p className="text-muted-foreground mb-2">
              When you purchase tickets, we share your name, email, phone, and ticket details with organizers.
            </p>

            <h3 className="text-base font-semibold mb-2 mt-4">3.2 With Other Users</h3>
            <p className="text-muted-foreground mb-2">
              Public info (profile, posts, comments) is visible to users. Organizers see attendee lists.
            </p>

            <h3 className="text-base font-semibold mb-2 mt-4">3.3 Service Providers</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Stripe (payments), Resend (email), Mux (video), PostHog (analytics)</li>
              <li>Supabase (database, auth, storage), Mapbox (maps)</li>
            </ul>

            <h3 className="text-base font-semibold mb-2 mt-4">3.4 Legal & Business</h3>
            <p className="text-muted-foreground mb-2">
              We may disclose if required by law or in business transfers (mergers, acquisitions).
            </p>

            <h3 className="text-base font-semibold mb-2 mt-4">3.5 We Do Not Sell Your Data</h3>
            <p className="text-muted-foreground">
              YardPass does not sell, rent, or trade your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Data Security</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong>Encryption:</strong> TLS/SSL in transit, encryption at rest</li>
              <li><strong>Authentication:</strong> Secure password hashing, optional 2FA</li>
              <li><strong>Access Controls:</strong> Role-based employee/contractor access</li>
              <li><strong>Payments:</strong> Stripe handles all card data (PCI-DSS compliant)</li>
              <li><strong>Audits:</strong> Continuous monitoring and vulnerability testing</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              No internet transmission is 100% secure. We strive to protect your data but cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Your Rights</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong>Access & Update:</strong> Manage your info via profile settings</li>
              <li><strong>Deletion:</strong> Request account deletion at support@yardpass.app</li>
              <li><strong>Marketing Opt-Out:</strong> Unsubscribe via email links or settings</li>
              <li><strong>Cookie Control:</strong> Manage via browser (may limit functionality)</li>
              <li><strong>Data Portability:</strong> Request data copy at support@yardpass.app</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Cookies & Tracking</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong>Essential:</strong> Login, security, core functionality</li>
              <li><strong>Analytics:</strong> Usage tracking (PostHog)</li>
              <li><strong>Functional:</strong> Preferences and settings</li>
              <li><strong>Video:</strong> Playback analytics (Mux)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Children's Privacy</h2>
            <p className="text-muted-foreground">
              Not intended for users under 13. We don't knowingly collect data from children under 13. 
              Parents believing their child provided info should contact privacy@yardpass.app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. International Transfers</h2>
            <p className="text-muted-foreground">
              YardPass operates in the U.S. Non-U.S. users' data is transferred and stored in the U.S. 
              By using YardPass, you consent to this transfer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Data Retention</h2>
            <p className="text-muted-foreground mb-2">We retain data while your account is active or as needed. After deletion:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Legal compliance and fraud prevention (up to 7 years for financial records)</li>
              <li>Dispute resolution and agreement enforcement</li>
              <li>Backups (30-90 days)</li>
              <li>Anonymized analytics (no personal identifiers)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">10. California Rights (CCPA)</h2>
            <p className="text-muted-foreground mb-2">California residents have additional rights:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Know what data is collected, used, shared</li>
              <li>Delete personal information (with exceptions)</li>
              <li>Opt-out of data sales (we don't sell data)</li>
              <li>Non-discrimination for exercising rights</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Contact privacy@yardpass.app with "California Privacy Rights" in subject.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">11. European Rights (GDPR)</h2>
            <p className="text-muted-foreground mb-2">EEA residents have GDPR rights:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Access, rectification, erasure, restriction, portability, objection</li>
              <li>Withdraw consent anytime</li>
              <li>Lodge complaints with local data protection authority</li>
            </ul>
            <p className="text-muted-foreground mt-2">Contact privacy@yardpass.app to exercise rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">12. Policy Changes</h2>
            <p className="text-muted-foreground mb-2">We may update this policy. Material changes will be communicated via:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Platform notice</li>
              <li>Email to registered address</li>
              <li>Updated "Last updated" date</li>
            </ul>
            <p className="text-muted-foreground mt-2">Continued use after changes = acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">13. Contact Us</h2>
            <div className="bg-muted p-4 rounded-lg space-y-1">
              <p className="font-semibold">YardPass, Inc.</p>
              <p className="text-muted-foreground">Email: privacy@yardpass.app</p>
              <p className="text-muted-foreground">Support: support@yardpass.app</p>
              <p className="text-muted-foreground">Data Protection: dpo@yardpass.app</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">14. Acceptance</h2>
            <p className="text-muted-foreground">
              By using YardPass, you acknowledge reading and understanding this Privacy Policy and agree to its terms. 
              If you disagree, please don't use our platform.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
