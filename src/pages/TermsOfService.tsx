import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TermsOfServiceProps {
  onBack: () => void;
}

export function TermsOfService({ onBack }: TermsOfServiceProps) {
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
            <h1>Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 prose prose-sm max-w-none">
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>By accessing or using YardPass, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using our services.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. Description of Service</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>YardPass is a video-first event discovery and ticketing platform that allows users to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Discover and attend events through a video-based feed</li>
                <li>Purchase tickets and manage event attendance</li>
                <li>Create and manage events as organizers</li>
                <li>Share content and interact with event communities</li>
                <li>Process payments and receive payouts for events</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. User Accounts</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>To use certain features of YardPass, you must create an account. You agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized use</li>
                <li>Be responsible for all activities under your account</li>
                <li>Use only one account per person or organization</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. User Roles and Responsibilities</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p><strong>Attendees</strong> may browse events, purchase tickets, and interact with event content. You agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide accurate information when purchasing tickets</li>
                <li>Comply with event rules and organizer requirements</li>
                <li>Use tickets only for personal attendance (no unauthorized resale)</li>
              </ul>
              <p><strong>Organizers</strong> may create and manage events, sell tickets, and receive payments. You agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide accurate event information and deliver promised services</li>
                <li>Comply with all applicable laws and regulations</li>
                <li>Handle refunds according to your stated policies</li>
                <li>Maintain appropriate insurance and licenses</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Content and Conduct</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Users may post videos, images, and text content. You agree not to post content that:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Violates any laws or third-party rights</li>
                <li>Contains hate speech, harassment, or threats</li>
                <li>Is sexually explicit or inappropriate</li>
                <li>Promotes illegal activities or substances</li>
                <li>Contains spam, scams, or misleading information</li>
                <li>Infringes on intellectual property rights</li>
              </ul>
              <p>We reserve the right to remove content and suspend accounts that violate these guidelines.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Payments and Fees</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>YardPass charges platform fees for ticket sales, similar to industry standards:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Service fees of approximately 3.7% + $1.79 per ticket</li>
                <li>Payment processing fees as determined by our payment partners</li>
                <li>Additional fees may apply for premium features</li>
              </ul>
              <p>All fees are clearly disclosed before completion of transactions.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Refunds and Cancellations</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Refund policies are set by individual event organizers. Generally:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Refunds may be available up to 7 days before an event (unless otherwise specified)</li>
                <li>Platform fees may not be refundable</li>
                <li>Event cancellations by organizers result in full refunds</li>
                <li>No-shows are not eligible for refunds unless specified by the organizer</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Intellectual Property</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>By posting content on YardPass, you grant us a non-exclusive license to use, modify, and display your content for the purpose of operating our services. You retain ownership of your content and may remove it at any time.</p>
              <p>YardPass and its associated trademarks, logos, and designs are our intellectual property and may not be used without permission.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Disclaimers and Limitation of Liability</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>YardPass is provided "as is" without warranties of any kind. We are not responsible for:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Event quality, safety, or organizer conduct</li>
                <li>User-generated content or interactions</li>
                <li>Technical issues or service interruptions</li>
                <li>Third-party services or payment processing</li>
              </ul>
              <p>Our liability is limited to the amount of fees paid to us in the 12 months preceding any claim.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">10. Termination</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We may terminate or suspend your account for violations of these terms or for any reason with 30 days notice. You may terminate your account at any time through your account settings.</p>
              <p>Upon termination, your right to use the service ceases immediately, but these terms remain in effect regarding past use.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">11. Changes to Terms</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We may update these terms from time to time. We will notify users of material changes through the platform or via email. Continued use of YardPass after changes constitutes acceptance of the new terms.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">12. Contact Information</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>For questions about these terms or our services, contact us at:</p>
              <ul className="list-none space-y-1">
                <li>Email: legal@yardpass.com</li>
                <li>Address: [Your Business Address]</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TermsOfService;