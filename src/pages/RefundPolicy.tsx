import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RefundPolicyProps {
  onBack: () => void;
}

export function RefundPolicy({ onBack }: RefundPolicyProps) {
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
            <h1>Refund Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 prose prose-sm max-w-none">
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. General Refund Policy</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Liventix facilitates ticket sales between event organizers and attendees. Refund policies are primarily set by individual event organizers, but we provide the following general guidelines:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Refunds are generally available up to 7 days before an event</li>
                <li>Platform fees may not be refundable depending on the circumstances</li>
                <li>All refund requests are processed through our secure platform</li>
                <li>Refund timeframes depend on your payment method and financial institution</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. Organizer-Set Policies</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Event organizers may set their own refund policies, which will be clearly displayed before ticket purchase. Common organizer policies include:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Standard Refund:</strong> Full refund available up to 7 days before the event</li>
                <li><strong>Flexible Refund:</strong> Full refund available up to 24 hours before the event</li>
                <li><strong>No Refund:</strong> All sales are final (often for heavily discounted tickets)</li>
                <li><strong>Custom Policy:</strong> Organizer-specific terms and conditions</li>
              </ul>
              <p>Always review the specific refund policy for each event before purchasing tickets.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Event Cancellations</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>If an event is cancelled by the organizer:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>You are entitled to a full refund including all fees</li>
                <li>Refunds are processed automatically within 5-10 business days</li>
                <li>You will be notified via email and in-app notification</li>
                <li>Original payment method will be credited</li>
              </ul>
              <p>If an event is postponed, you may choose between attending the new date or requesting a full refund.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Platform Fees</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Liventix platform fees (~3.7% + $1.79 per ticket) are handled as follows:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Event Cancellation:</strong> Platform fees are fully refunded</li>
                <li><strong>Customer-Initiated Refund:</strong> Platform fees may be retained to cover processing costs</li>
                <li><strong>Organizer Goodwill Refund:</strong> Platform fees are refunded if processed within 24 hours</li>
                <li><strong>Policy Violation:</strong> Full refund including platform fees</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. How to Request a Refund</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>To request a refund:</p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Go to your profile and find the ticket in "Your Tickets"</li>
                <li>Click "Request Refund" if available (based on the event's policy)</li>
                <li>Select your reason for the refund request</li>
                <li>Submit the request for organizer review</li>
                <li>Receive confirmation and tracking information via email</li>
              </ol>
              <p>If the "Request Refund" option is not available, the event has a no-refund policy or the deadline has passed.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Refund Processing Times</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Refund processing times vary by payment method:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Credit Cards:</strong> 5-10 business days</li>
                <li><strong>Debit Cards:</strong> 5-10 business days</li>
                <li><strong>Digital Wallets:</strong> 1-3 business days</li>
                <li><strong>Bank Transfers:</strong> 3-7 business days</li>
              </ul>
              <p>Processing times may be longer during peak periods or holidays. You will receive email confirmation when the refund is processed.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Special Circumstances</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We may provide refunds outside of standard policies in cases of:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Medical Emergency:</strong> With appropriate documentation</li>
                <li><strong>Travel Restrictions:</strong> Government-imposed restrictions preventing attendance</li>
                <li><strong>Platform Error:</strong> Technical issues causing incorrect purchases</li>
                <li><strong>Fraud Prevention:</strong> Unauthorized transactions</li>
                <li><strong>Organizer Violation:</strong> Events that violate our terms of service</li>
              </ul>
              <p>Each case is reviewed individually by our support team.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Denied Refund Requests</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Refund requests may be denied if:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>The request is made after the deadline specified in the event's policy</li>
                <li>You attended the event (check-in was recorded)</li>
                <li>The event has a clearly stated no-refund policy</li>
                <li>You violated event terms or were removed for misconduct</li>
              </ul>
              <p>If your refund is denied, you can contact our support team for review or appeal the decision.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Partial Refunds</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>In some cases, partial refunds may be offered:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Event changes that significantly impact the experience</li>
                <li>Late refund requests processed as organizer goodwill</li>
                <li>Platform technical issues affecting event access</li>
                <li>Weather-related modifications for outdoor events</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">10. Contact Support</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>For refund-related questions or disputes, contact our support team:</p>
              <ul className="list-none space-y-1">
                <li>Email: refunds@liventix.com</li>
                <li>Support Portal: Available in your account dashboard</li>
                <li>Response Time: We aim to respond within 24 hours</li>
              </ul>
              <p>Please include your order number and relevant details when contacting support.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default RefundPolicy;