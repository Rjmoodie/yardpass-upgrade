import { ArrowLeft } from 'lucide-react';

interface TermsOfServiceProps {
  onBack: () => void;
}

export function TermsOfService({ onBack }: TermsOfServiceProps) {
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
            <h1 className="text-base md:text-lg font-semibold">Terms of Service</h1>
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
            <h2 className="text-base md:text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              These Terms of Service (<q>Terms</q>) govern your access to and use of the Liventix event
              discovery, ticketing, and social platform, including our websites, mobile applications, and
              related services (collectively, the <q>Services</q>). By accessing or using the Services, you
              agree to be bound by these Terms and all applicable laws and regulations. If you do not agree,
              you must not use the Services.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">2. Eligibility</h2>
            <p className="text-muted-foreground">
              You must be at least 13 years old to use the Services. If you are under the age of majority in
              your jurisdiction, you may only use the Services with the consent of a parent or legal guardian
              who agrees to be bound by these Terms. By using the Services, you represent and warrant that you
              meet these requirements and that you are not prohibited from using the Services under applicable
              law.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">3. Description of Services</h2>
            <p className="text-muted-foreground mb-2">
              Liventix provides a video-first event discovery and ticketing platform that enables:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Attendees to discover, follow, and attend events</li>
              <li>Attendees to purchase tickets and manage event access</li>
              <li>Organizers to create, promote, and manage events</li>
              <li>Organizers to sell tickets and receive payouts (via third-party payment providers)</li>
              <li>Users to post content, comment, and message other users where available</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Liventix is a platform that connects attendees and organizers. Unless explicitly stated
              otherwise, Liventix is not the creator, producer, or operator of events listed on the Services,
              and we are not a party to the transaction between organizers and attendees.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">4. User Accounts</h2>
            <p className="text-muted-foreground mb-2">
              To use certain features, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and promptly update your information as needed</li>
              <li>Keep your login credentials secure and confidential</li>
              <li>Notify us promptly of any unauthorized access or use of your account</li>
              <li>Be responsible for all activities that occur under your account</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              We reserve the right to refuse, suspend, or terminate any account at our discretion, consistent
              with these Terms and applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">5. Roles and Responsibilities</h2>
            <p className="text-muted-foreground mb-2">
              Different users may have different roles on the platform, such as attendees, organizers, and
              organization members.
            </p>

            <p className="text-muted-foreground font-semibold mt-2">5.1 Attendees</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Use accurate information when purchasing tickets or registering for events.</li>
              <li>Comply with event-specific rules, venue policies, and applicable laws.</li>
              <li>
                Use tickets for personal attendance only, unless ticket transfer is explicitly permitted
                through the Services.
              </li>
              <li>Respect organizers, staff, and other attendees at all times.</li>
            </ul>

            <p className="text-muted-foreground font-semibold mt-2">5.2 Organizers and Organizations</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                Provide accurate and complete information about events, including dates, times, locations,
                pricing, restrictions, and refund policies.
              </li>
              <li>
                Deliver events substantially as described and comply with all applicable laws, regulations,
                permits, and licensing requirements.
              </li>
              <li>
                Honor published refund policies and respond promptly to attendee inquiries and support
                requests.
              </li>
              <li>
                Ensure that any marketing or sponsorship claims are truthful and not misleading.
              </li>
              <li>
                Maintain appropriate insurance coverage and manage on-site safety and security for attendees.
              </li>
            </ul>

            <p className="text-muted-foreground mt-2">
              Organizers are independent from Liventix. Liventix is not responsible for organizer actions or
              omissions, event quality, or compliance with organizer obligations, except to the limited extent
              required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">6. Content and Conduct</h2>
            <p className="text-muted-foreground mb-2">
              Users may post videos, images, text, and other content (<q>User Content</q>) to or through the
              Services. You are solely responsible for your User Content and your interactions with others on
              the platform. You agree not to post or share any content that:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Violates any applicable law, regulation, or third-party rights</li>
              <li>Contains hate speech, harassment, threats, or incitement to violence</li>
              <li>Is sexually explicit, exploitative, or otherwise inappropriate for the platform</li>
              <li>Promotes illegal activities, dangerous conduct, or controlled substances</li>
              <li>Is fraudulent, deceptive, or misleading</li>
              <li>Infringes any copyright, trademark, or other intellectual property or proprietary right</li>
              <li>Discloses personal or confidential information of others without consent</li>
              <li>Constitutes spam, unsolicited promotion, or malicious content</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              We may, but are not obligated to, monitor, review, or remove User Content at our discretion for
              any reason, including violations of these Terms or our Community Guidelines. We may also suspend
              or terminate accounts in connection with such violations.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">7. Payments, Fees, and Payouts</h2>
            <p className="text-muted-foreground mb-2">
              Payments for tickets and services are processed by third-party payment processors such as
              Stripe. By initiating a payment, you agree to the applicable payment processor&apos;s terms and
              conditions in addition to these Terms.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Service Fees:</strong> Liventix may charge service fees, organizer fees, or other
                charges for use of the Services. Applicable fees, taxes, and charges will be disclosed at
                checkout or before you confirm a transaction.
              </li>
              <li>
                <strong>Organizer Payouts:</strong> Organizers may be required to create and maintain Stripe
                Connect or similar accounts to receive payouts. Payout timing and availability depend on the
                payment provider and applicable risk and compliance checks.
              </li>
              <li>
                <strong>Taxes:</strong> Organizers are responsible for determining and remitting any taxes
                owed in connection with their events and payouts, except where we are required by law to
                collect or remit certain taxes.
              </li>
              <li>
                <strong>Currency:</strong> Transactions generally occur in the currency displayed at checkout
                and may be subject to currency conversion and related fees by your bank or card issuer.
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              We reserve the right to change our fees and pricing at any time, subject to advance notice where
              required by law. Fee changes will not retroactively affect completed transactions.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">8. Refunds and Cancellations</h2>
            <p className="text-muted-foreground mb-2">
              Refund policies are primarily determined by event organizers and will be displayed during the
              purchase flow or in the event details. By purchasing a ticket, you agree to the applicable
              refund policy for that event.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                Organizers may offer full, partial, or no refunds, subject to their stated policy and
                applicable law.
              </li>
              <li>
                In the case of event cancellation or significant changes, organizers may be required to offer
                refunds, credits, or alternative arrangements.
              </li>
              <li>
                Platform service fees and payment processing fees may be non-refundable except where required
                by law or where Liventix elects to do so at its discretion.
              </li>
              <li>
                No-shows or failure to attend an event will generally not be eligible for refunds unless
                explicitly stated otherwise.
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Liventix may, but is not obligated to, facilitate refunds through the Services. Our ability to
              issue refunds may be limited by the organizer&apos;s funds, payment provider policies, and
              applicable law. Our Refund Policy provides additional detail and is incorporated into these
              Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">9. Intellectual Property</h2>
            <p className="text-muted-foreground mb-2">
              The Services, including all content, features, and functionality (excluding User Content), are
              owned by or licensed to Liventix and are protected by copyright, trademark, and other laws.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                You may access and use the Services for your personal or internal business purposes consistent
                with these Terms.
              </li>
              <li>
                You may not copy, modify, distribute, sell, or lease any part of the Services, or reverse
                engineer or attempt to extract the source code for the Services, except as permitted by law.
              </li>
            </ul>
            <p className="text-muted-foreground mt-2 font-semibold">9.1 User Content License</p>
            <p className="text-muted-foreground">
              By posting or submitting User Content, you grant Liventix a worldwide, non-exclusive,
              royalty-free, transferable, and sublicensable license to host, store, reproduce, modify, adapt,
              publish, translate, create derivative works from, distribute, publicly display, and publicly
              perform such content in connection with operating, improving, and promoting the Services. You
              retain ownership of your User Content, subject to this license.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">10. Third-Party Services</h2>
            <p className="text-muted-foreground">
              The Services may integrate with or rely on third-party services, including payment processors,
              video platforms, analytics providers, and map services. These third parties are independent of
              Liventix and subject to their own terms and privacy policies. We are not responsible for the
              content, availability, or practices of third-party services, except to the limited extent
              required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">11. Disclaimers</h2>
            <p className="text-muted-foreground mb-2">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICES ARE PROVIDED <q>AS IS</q> AND <q>AS
              AVAILABLE</q> WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
              BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
              AND NON-INFRINGEMENT.
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                We do not warrant that the Services will be uninterrupted, secure, error-free, or free from
                harmful components.
              </li>
              <li>
                We do not endorse, guarantee, or assume responsibility for any events, organizers, content, or
                services provided by third parties through the platform.
              </li>
              <li>
                You acknowledge that events may carry inherent risks and that your attendance is voluntary and
                at your own risk.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">12. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-2">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LIVENTIX AND ITS OFFICERS, DIRECTORS, EMPLOYEES,
              CONTRACTORS, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT
              OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICES, EVEN IF WE HAVE BEEN
              ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING OUT OF OR
              RELATING TO THE SERVICES OR THESE TERMS WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID
              TO US (EXCLUDING AMOUNTS PAID TO ORGANIZERS) DURING THE SIX (6) MONTHS PRECEDING THE CLAIM, OR
              (B) ONE HUNDRED U.S. DOLLARS (US $100). SOME JURISDICTIONS DO NOT ALLOW LIMITATIONS OF LIABILITY,
              SO THESE LIMITATIONS MAY NOT APPLY TO YOU.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">13. Indemnification</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, you agree to indemnify, defend, and hold harmless
              Liventix and its officers, directors, employees, contractors, and agents from and against any
              claims, liabilities, damages, losses, and expenses (including reasonable attorneys&apos; fees)
              arising out of or in connection with your use of the Services, your User Content, your violation
              of these Terms, or your violation of any rights of another person or entity.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">14. Termination</h2>
            <p className="text-muted-foreground mb-2">
              We may suspend or terminate your access to the Services at any time, with or without notice, if
              we believe you have violated these Terms, our Community Guidelines, applicable law, or if we
              decide to discontinue the Services. You may terminate your account at any time through your
              account settings, where available, or by contacting us.
            </p>
            <p className="text-muted-foreground">
              Upon termination, your right to access the Services will cease immediately. Certain obligations
              and provisions of these Terms, including those relating to intellectual property, disclaimers,
              limitations of liability, and indemnity, will survive termination.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">15. Changes to These Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms from time to time. If we make material changes, we will provide
              reasonable notice through the Services, by email, or both. The <q>Last updated</q> date at the
              top of this page indicates when these Terms were last revised. Your continued use of the
              Services after changes become effective constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">16. Contact Information</h2>
            <div className="bg-muted p-4 rounded-lg text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Liventix, Inc.</p>
              <p>Email (Legal): <span className="font-mono">legal@liventix.app</span></p>
              <p>Email (Support): <span className="font-mono">support@liventix.app</span></p>
              {/* Replace with real mailing address once finalized */}
              {/* <p>Address: ...</p> */}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TermsOfService;
