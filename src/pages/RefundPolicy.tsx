import { ArrowLeft } from 'lucide-react';

interface RefundPolicyProps {
  onBack: () => void;
}

export function RefundPolicy({ onBack }: RefundPolicyProps) {
  return (
    <div className="h-full bg-background flex flex-col text-xs sm:text-sm md:text-[15px]">
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
            <h1 className="text-base md:text-lg font-semibold">Refund Policy</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6 leading-relaxed">
          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">1. Overview</h2>
            <p className="text-muted-foreground">
              Liventix provides tools for event organizers to sell tickets and manage attendance. Unless
              expressly stated otherwise, Liventix is not the organizer of events listed on the platform.
              Refund policies for tickets are primarily determined and controlled by the individual event
              organizers, subject to applicable law and the terms described below.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">2. Organizer-Defined Policies</h2>
            <p className="text-muted-foreground mb-2">
              Each event may have its own refund policy, which will be displayed in the event details and/or
              at checkout. By purchasing a ticket, you agree to the organizer&apos;s refund policy for that
              event. Common approaches include:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Standard Refund:</strong> Full or partial refund available up to a defined number of
                days before the event.
              </li>
              <li>
                <strong>Flexible Refund:</strong> Refunds available closer to the event date (for example,
                within 24–48 hours of the start time).
              </li>
              <li>
                <strong>No-Refund Policy:</strong> All sales are final, except where required by law or in
                specific exceptional circumstances.
              </li>
              <li>
                <strong>Custom Policy:</strong> Organizers may define custom conditions and timelines for
                refunds or credits.
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Always review the refund terms for each event before completing your purchase. If no explicit
              policy is stated, a default policy may apply as set by Liventix or required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">3. Event Cancellations and Changes</h2>
            <p className="text-muted-foreground mb-2">
              If an organizer cancels or significantly changes an event (such as date, time, or venue), the
              following generally apply:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Full Cancellation:</strong> Attendees are typically entitled to a refund of the ticket
                price. Depending on the circumstances and applicable law, service fees may also be refunded.
              </li>
              <li>
                <strong>Rescheduled Events:</strong> Tickets may remain valid for the new date. Organizers may
                choose to offer refunds or credits if you cannot attend the rescheduled event.
              </li>
              <li>
                <strong>Partial Changes:</strong> Material changes (such as major lineup changes) may qualify
                for refunds or credits as described in the event&apos;s policy or required by law.
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Liventix may assist in notifying attendees of cancellations or changes, but the organizer is
              responsible for the underlying decision and its consequences.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">4. Platform Service Fees</h2>
            <p className="text-muted-foreground mb-2">
              In addition to ticket prices, Liventix may charge service fees and/or processing fees, which are
              disclosed during checkout. Treatment of these fees in refund scenarios may vary:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Organizer or Platform Cancellation:</strong> In many cases, Liventix aims to refund
                ticket prices and may, at its discretion or where required by law, refund service fees and
                applicable taxes.
              </li>
              <li>
                <strong>Attendee-Initiated Refunds:</strong> Where refunds are allowed and initiated by the
                attendee under the event&apos;s policy, service fees may be non-refundable to cover platform
                and processing costs, unless otherwise stated or required by law.
              </li>
              <li>
                <strong>Goodwill and Error Corrections:</strong> For clear platform errors or duplicate
                purchases, Liventix may choose to refund certain fees on a case-by-case basis.
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Fee treatment may differ by jurisdiction and payment method, and may be subject to limitations of
              payment processors and organizers&apos; available funds.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">5. How to Request a Refund</h2>
            <p className="text-muted-foreground mb-2">
              Where refund requests are permitted under the applicable policy, you can generally request a
              refund through the Services:
            </p>
            <ol className="list-decimal pl-6 space-y-1 text-muted-foreground">
              <li>Open your account and navigate to <q>Your Tickets</q> or a similar section.</li>
              <li>Select the relevant event and ticket.</li>
              <li>If available, click <q>Request Refund</q> and follow the prompts.</li>
              <li>Select a reason and submit your request.</li>
            </ol>
            <p className="text-muted-foreground mt-2">
              If the refund option is not available, the event may have a no-refund policy, or the refund
              window may have expired. In some cases, you may still contact support for review, especially in
              extraordinary circumstances (such as serious illness, travel restrictions, or platform error).
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">6. Processing Times</h2>
            <p className="text-muted-foreground mb-2">
              Once a refund is approved and processed, the time it takes for funds to appear in your account
              depends on your payment method and financial institution. Typical timelines (subject to change)
              include:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Credit and debit cards: typically 5–10 business days</li>
              <li>Digital wallets: typically 1–3 business days</li>
              <li>Bank transfers: typically 3–7 business days</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Delays may occur due to processing by payment processors, banks, or holidays. Liventix is not
              responsible for delays outside of our direct control once the refund has been submitted to the
              payment provider.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">7. Special Circumstances and Exceptions</h2>
            <p className="text-muted-foreground mb-2">
              In addition to organizer policies, Liventix may review refunds outside of standard terms in
              limited circumstances, such as:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Documented medical emergencies or serious personal circumstances</li>
              <li>Government-imposed travel or gathering restrictions</li>
              <li>Clear platform or technical errors resulting in incorrect charges</li>
              <li>Evidence of fraud or unauthorized use of your payment method</li>
              <li>Events that violate our Terms of Service or Community Guidelines</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Any such accommodations are at the discretion of Liventix and/or the organizer, and do not
              create an obligation to grant similar requests in the future.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">8. Denials and Appeals</h2>
            <p className="text-muted-foreground mb-2">
              Refund requests may be denied, including when:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>The event has a clearly stated no-refund policy and no exception applies.</li>
              <li>The refund window or deadline has passed.</li>
              <li>Our records show that the ticket was used or check-in was completed.</li>
              <li>The request conflicts with applicable law, payment processor rules, or fraud controls.</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              If you believe a refund was improperly denied, you may contact our support team with additional
              details, and we will review the request again where appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">9. Chargebacks and Disputes</h2>
            <p className="text-muted-foreground">
              If you initiate a chargeback or payment dispute through your bank or card issuer, this may delay
              or complicate any refund process through the Services. We reserve the right to contest
              chargebacks we believe are improper and to limit or terminate access to the Services for accounts
              associated with fraudulent or abusive chargeback activity.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">10. Contact</h2>
            <div className="bg-muted p-4 rounded-lg text-muted-foreground space-y-1">
              <p>For refund-related questions or support, you can contact:</p>
              <p>
                Email: <span className="font-mono">refunds@liventix.app</span>
              </p>
              <p>
                General Support: <span className="font-mono">support@liventix.app</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default RefundPolicy;
