import { ArrowLeft } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
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
            <h1 className="text-base md:text-lg font-semibold">Privacy Policy</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8 leading-relaxed">
          <p className="font-medium">
            Liventix, Inc. (<q>Liventix</q>, <q>we</q>, <q>us</q>, or <q>our</q>) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your
            information when you use our event discovery, ticketing, and social platform, including our
            websites, mobile applications, and related services (collectively, the <q>Services</q>).
          </p>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">1. Who We Are</h2>
            <p className="text-muted-foreground">
              For users in jurisdictions that recognize the concept of a data controller, Liventix, Inc. is
              the controller of your personal information in connection with the Services, except where we
              act as a processor on behalf of event organizers in relation to certain attendee data.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">2. Information We Collect</h2>

            <h3 className="text-sm font-semibold mb-2 mt-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Account Information:</strong> Name, email address, phone number, password or login
                credentials, profile photo, biography, social links, and preferences.
              </li>
              <li>
                <strong>Payment Information:</strong> We do not store full card numbers. Payment card data is
                collected and processed directly by our payment providers (such as Stripe). We may receive
                limited information related to your transactions (e.g., the last four digits of your card,
                card type, and transaction status).
              </li>
              <li>
                <strong>Event Information:</strong> Event titles, descriptions, categories, dates, times,
                locations, ticket types, prices, and associated media and configuration data you provide.
              </li>
              <li>
                <strong>User Content:</strong> Posts, comments, reactions, event reviews, photos, videos,
                messages, and any other content you upload or create on the Services.
              </li>
              <li>
                <strong>Organization Data:</strong> Organization names, handles, logos, descriptions,
                verification documents, payout information (via Stripe Connect), and team member details
                (such as names, roles, and email addresses).
              </li>
            </ul>

            <h3 className="text-sm font-semibold mb-2 mt-4">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Usage Data:</strong> Pages and screens viewed, links and buttons clicked, features
                used, time spent, event and video views, search queries, and interactions with content and
                other users.
              </li>
              <li>
                <strong>Device and Technical Data:</strong> IP address, browser type and settings, device
                identifiers, operating system, app version, and performance diagnostics.
              </li>
              <li>
                <strong>Location Data:</strong> Approximate location (e.g., city, region) derived from IP
                address. If you enable device location services, we may collect more precise location data to
                improve event discovery and recommendations.
              </li>
              <li>
                <strong>Cookies and Similar Technologies:</strong> Cookies, local storage, pixels, and similar
                technologies are used for authentication, security, preferences, analytics, and personalization.
              </li>
            </ul>

            <h3 className="text-sm font-semibold mb-2 mt-4">2.3 Information from Third Parties</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Payment Providers:</strong> Transaction details and limited payment information from
                Stripe or similar providers, to confirm payments, issue refunds, and prevent fraud.
              </li>
              <li>
                <strong>Analytics and Video Providers:</strong> Analytics data from PostHog and video usage
                metrics from Mux (such as playback performance, errors, and engagement).
              </li>
              <li>
                <strong>Authentication and Social Login:</strong> If you connect or log in via third-party
                accounts (where available), we may receive basic profile information consistent with your
                settings on that service.
              </li>
              <li>
                <strong>Maps and Geolocation:</strong> Location and map-related information from providers
                like Mapbox to power map views and location-based features.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-2">
              We use your information for the following purposes, depending on your relationship with us and
              applicable law:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Service Delivery and Operations:</strong> To operate, maintain, and provide the
                Services; create and manage accounts; process ticket purchases and refunds; enable event
                creation, ticket scanning, and check-in; and support messaging and social features.
              </li>
              <li>
                <strong>Communications:</strong> To send transactional emails and push notifications (such as
                purchase confirmations, event reminders, safety updates, and important account notices), and,
                where permitted, marketing communications you can opt out of at any time.
              </li>
              <li>
                <strong>Personalization and Recommendations:</strong> To recommend events, content, and
                organizers based on your interests, behavior, and location, and to personalize your experience
                on the platform.
              </li>
              <li>
                <strong>Analytics and Product Improvement:</strong> To analyze usage patterns, measure
                performance, diagnose issues, and develop new features and offerings using tools such as
                PostHog and our first-party analytics.
              </li>
              <li>
                <strong>Safety, Security, and Integrity:</strong> To protect users and the platform, detect and
                prevent fraud and abuse, enforce our Terms of Service and Community Guidelines, and monitor
                for suspicious or harmful activity.
              </li>
              <li>
                <strong>Legal and Compliance:</strong> To comply with legal obligations, respond to lawful
                requests and legal processes, and protect the rights, property, or safety of Liventix, our
                users, organizers, and the public.
              </li>
              <li>
                <strong>With Your Consent:</strong> For any other purpose disclosed to you at the time of
                collection, where you have given consent and where consent is required by law.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">4. How We Share Information</h2>

            <h3 className="text-sm font-semibold mb-2 mt-3">4.1 Event Organizers and Attendees</h3>
            <p className="text-muted-foreground mb-2">
              When you purchase tickets or interact with an event, we share information with the relevant
              organizer to enable them to manage the event and comply with their own obligations. This
              typically includes your name, email address, ticket details, and any additional attendee
              information collected for that event. Organizers are independent controllers of this data in
              many cases and may have their own privacy policies.
            </p>

            <h3 className="text-sm font-semibold mb-2 mt-3">4.2 Other Users</h3>
            <p className="text-muted-foreground mb-2">
              Certain information you choose to make public will be visible to other users, such as your
              public profile, public posts, comments, and event-related activity. Depending on event settings,
              organizers may see anonymized or identified attendee counts and engagement data.
            </p>

            <h3 className="text-sm font-semibold mb-2 mt-3">4.3 Service Providers and Partners</h3>
            <p className="text-muted-foreground mb-2">
              We share information with trusted service providers who process data on our behalf and under our
              instructions, including:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Stripe and similar providers for payments and payouts</li>
              <li>Supabase for hosting, authentication, database, and storage</li>
              <li>Resend or similar providers for email delivery</li>
              <li>Mux for video processing, streaming, and analytics</li>
              <li>PostHog for analytics and product insights</li>
              <li>Mapbox for maps and geolocation features</li>
              <li>
                Other infrastructure, security, and support providers as reasonably necessary to provide the
                Services
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              These providers are contractually required to use your information only as needed to provide
              services to us and to protect it appropriately.
            </p>

            <h3 className="text-sm font-semibold mb-2 mt-3">4.4 Legal, Safety, and Business Transfers</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Legal and Safety:</strong> We may disclose information if we believe in good faith that
                it is reasonably necessary to comply with applicable law, regulation, legal process, or
                governmental request; to enforce our Terms of Service or Community Guidelines; or to protect
                the rights, property, or safety of Liventix, our users, organizers, or the public.
              </li>
              <li>
                <strong>Business Transfers:</strong> If we are involved in a merger, acquisition, financing,
                reorganization, bankruptcy, or sale of all or a portion of our assets, your information may be
                transferred as part of that transaction, subject to any applicable legal requirements.
              </li>
            </ul>

            <h3 className="text-sm font-semibold mb-2 mt-3">4.5 No Sale of Personal Information</h3>
            <p className="text-muted-foreground">
              We do not sell, rent, or trade your personal information as the term <q>sale</q> is commonly
              understood in privacy regulations such as the CCPA/CPRA. If this changes in the future, we will
              update this Policy and provide any legally required notices or opt-out mechanisms.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">5. Data Security</h2>
            <p className="text-muted-foreground mb-2">
              We use administrative, technical, and physical safeguards designed to protect your information.
              These measures include, for example:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Transport-layer security (TLS) for data in transit</li>
              <li>Industry-standard security practices by our hosting and infrastructure providers</li>
              <li>Access controls and role-based permissions for internal systems</li>
              <li>Use of reputable third-party providers for payments and authentication</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              However, no method of transmission over the internet or electronic storage is completely secure,
              and we cannot guarantee absolute security. You are responsible for maintaining the
              confidentiality of your account credentials and for any activity under your account.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">6. Your Choices and Rights</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Account Settings:</strong> You can access and update certain account information
                (such as profile details and preferences) directly within the Services.
              </li>
              <li>
                <strong>Marketing Communications:</strong> You can opt out of marketing emails by using the
                unsubscribe link in those emails or updating your settings. We may still send transactional or
                service-related communications.
              </li>
              <li>
                <strong>Cookies and Tracking:</strong> You can manage cookies and similar technologies through
                your browser or device settings. Disabling certain cookies may affect the functionality of the
                Services.
              </li>
              <li>
                <strong>Access, Correction, and Deletion:</strong> Depending on your jurisdiction, you may
                have the right to request access to, correction of, or deletion of your personal information.
                You can contact us at <span className="font-mono">privacy@liventix.app</span> or as described
                below to exercise these rights.
              </li>
              <li>
                <strong>Data Portability:</strong> Where applicable law provides, you may request a copy of
                your personal information in a portable format.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">7. Cookies and Similar Technologies</h2>
            <p className="text-muted-foreground mb-2">
              We use cookies and similar technologies for authentication, security, analytics, and
              personalization. Categories may include:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Essential:</strong> Required for login, security, and core functionality of the
                Services.
              </li>
              <li>
                <strong>Analytics:</strong> Used to understand how users interact with the Services and to
                improve performance (for example, via PostHog).
              </li>
              <li>
                <strong>Functional:</strong> Used to remember preferences and improve user experience.
              </li>
              <li>
                <strong>Video and Media:</strong> Used by providers like Mux to deliver and improve media
                playback.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">8. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground">
              The Services are not directed to children under 13, and we do not knowingly collect personal
              information from children under 13. If we become aware that a child under 13 has provided us
              with personal information, we will take reasonable steps to delete such information. If you
              believe a child has provided us with personal information, please contact us at{' '}
              <span className="font-mono">privacy@liventix.app</span>.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">9. International Data Transfers</h2>
            <p className="text-muted-foreground">
              Liventix is based in the United States, and your information may be processed and stored in the
              United States and other countries that may have data protection laws that differ from those of
              your jurisdiction. Where required by law, we implement appropriate safeguards, such as standard
              contractual clauses, for the transfer of personal information. By using the Services, you
              acknowledge that your information may be transferred to and processed in these locations.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">10. Data Retention</h2>
            <p className="text-muted-foreground mb-2">
              We retain personal information for as long as necessary to provide the Services, fulfill the
              purposes described in this Policy, and comply with our legal obligations. Retention periods may
              vary depending on the type of data and our legal or business needs, including:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Records related to payments, refunds, and tax obligations</li>
              <li>Security, fraud prevention, and abuse detection records</li>
              <li>Backups and archival copies maintained for a limited period</li>
              <li>Anonymized or aggregated data used for analytics and reporting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">
              11. California Privacy Rights (CCPA/CPRA)
            </h2>
            <p className="text-muted-foreground mb-2">
              If you are a California resident, you may have certain rights regarding your personal
              information under the California Consumer Privacy Act (<q>CCPA</q>) and the California Privacy
              Rights Act (<q>CPRA</q>), subject to applicable exemptions. These may include the rights to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Request to know the categories and specific pieces of personal information we collect</li>
              <li>Request deletion of personal information, subject to certain exceptions</li>
              <li>Request correction of inaccurate personal information</li>
              <li>Receive information about how we share personal information</li>
              <li>
                Be free from discrimination for exercising these rights, consistent with applicable law
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              To exercise these rights, contact us at{' '}
              <span className="font-mono">privacy@liventix.app</span> with <q>California Privacy Rights</q> in
              the subject line. We may need to verify your identity before responding to your request.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">12. European and UK Privacy Rights (GDPR)</h2>
            <p className="text-muted-foreground mb-2">
              If you are located in the European Economic Area, the United Kingdom, or another region that
              provides similar rights, you may have the following rights with respect to your personal
              information, subject to applicable exceptions:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Right of access, rectification, and erasure</li>
              <li>Right to restrict or object to processing</li>
              <li>Right to data portability</li>
              <li>Right to withdraw consent at any time where processing is based on consent</li>
              <li>
                Right to lodge a complaint with a supervisory authority or data protection regulator in your
                country of residence or workplace
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              You can contact us at <span className="font-mono">dpo@liventix.app</span> to exercise these
              rights. We may request additional information to confirm your identity.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">13. Changes to This Policy</h2>
            <p className="text-muted-foreground mb-2">
              We may update this Privacy Policy from time to time. If we make material changes, we will provide
              notice through the Services, by email, or both. The <q>Last updated</q> date at the top of this
              page indicates when this Policy was last revised.
            </p>
            <p className="text-muted-foreground">
              Your continued use of the Services after any changes become effective means you accept the
              updated Policy. If you do not agree to the updated Policy, you should stop using the Services.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">14. Contact Us</h2>
            <div className="bg-muted p-4 rounded-lg space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">Liventix, Inc.</p>
              <p>Email (Privacy): <span className="font-mono">privacy@liventix.app</span></p>
              <p>Email (Support): <span className="font-mono">support@liventix.app</span></p>
              <p>Email (Data Protection): <span className="font-mono">dpo@liventix.app</span></p>
              {/* You can add a physical mailing address here once finalized */}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
