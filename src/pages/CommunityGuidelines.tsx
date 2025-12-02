import { ArrowLeft } from 'lucide-react';

interface CommunityGuidelinesProps {
  onBack: () => void;
}

export function CommunityGuidelines({ onBack }: CommunityGuidelinesProps) {
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
            <h1 className="text-base md:text-lg font-semibold">Community Guidelines</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Last updated: January 14, 2025
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8 leading-relaxed">
          <p className="font-medium">
            Liventix is a community-driven platform for discovering, attending, and creating events. These
            Community Guidelines are designed to help ensure a safe, respectful, and trustworthy environment.
            They supplement and form part of our Terms of Service. Violations may result in content removal,
            feature restrictions, or account suspension or termination.
          </p>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">1. Core Principles</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Respect:</strong> Treat all members—attendees, organizers, staff, and partners—with
                dignity, courtesy, and professionalism.
              </li>
              <li>
                <strong>Safety:</strong> Help maintain a safe experience online and at in-person events. Do
                not endanger others or encourage harmful conduct.
              </li>
              <li>
                <strong>Integrity:</strong> Be honest and transparent. Do not misrepresent who you are, your
                role, or what your event offers.
              </li>
              <li>
                <strong>Inclusivity:</strong> Foster an environment where people of different backgrounds and
                perspectives feel welcome.
              </li>
              <li>
                <strong>Responsibility:</strong> Take responsibility for your content, events, and behavior.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">2. Content Standards</h2>

            <h3 className="text-sm font-semibold mt-3 mb-1">2.1 Encouraged Content</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Authentic videos, photos, and descriptions that accurately represent events</li>
              <li>Helpful, honest reviews and feedback about events and experiences</li>
              <li>Constructive discussion and respectful debate related to events and topics</li>
              <li>Original content that you created or have the right to use and share</li>
            </ul>

            <h3 className="text-sm font-semibold mt-4 mb-1">2.2 Prohibited Content</h3>
            <p className="text-muted-foreground mb-1">
              You may not post, share, or otherwise engage in content that includes or promotes:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Illegal Activity:</strong> Activities or content that violate any applicable law or
                regulation.
              </li>
              <li>
                <strong>Hate and Harassment:</strong> Content that targets, threatens, or degrades individuals
                or groups based on race, ethnicity, nationality, religion, gender, sexual orientation,
                disability, or other protected characteristics.
              </li>
              <li>
                <strong>Violence and Threats:</strong> Direct or indirect threats, incitement to violence, or
                graphic depictions of violence.
              </li>
              <li>
                <strong>Sexual Content and Exploitation:</strong> Explicit sexual content, non-consensual
                imagery, sexual exploitation, or content inappropriate for a general event audience.
              </li>
              <li>
                <strong>Self-Harm:</strong> Promotion of self-harm, suicide, or eating disorders.
              </li>
              <li>
                <strong>Fraud and Misrepresentation:</strong> Scams, deceptive offers, counterfeit tickets, or
                misleading event descriptions.
              </li>
              <li>
                <strong>Intellectual Property Infringement:</strong> Content that infringes copyrights,
                trademarks, or other proprietary rights without authorization.
              </li>
              <li>
                <strong>Privacy Violations:</strong> Doxxing or sharing of private or identifying information
                about others without consent.
              </li>
              <li>
                <strong>Spam and Malicious Content:</strong> Repetitive or irrelevant posts, mass messaging,
                phishing, malware, or attempts to compromise accounts or systems.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">3. Event-Specific Expectations</h2>

            <h3 className="text-sm font-semibold mt-3 mb-1">3.1 Organizers</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                Provide clear, accurate information about event dates, locations, pricing, restrictions, and
                refund policies.
              </li>
              <li>
                Communicate promptly and transparently about changes, delays, or cancellations.
              </li>
              <li>
                Manage on-site safety in compliance with applicable laws and venue standards.
              </li>
              <li>
                Respect attendee privacy, only collecting and using attendee data consistent with published
                policies and applicable law.
              </li>
              <li>
                Do not advertise events that cannot reasonably be delivered, or that you do not intend to
                honor.
              </li>
            </ul>

            <h3 className="text-sm font-semibold mt-4 mb-1">3.2 Attendees</h3>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Follow event and venue rules as well as local laws and regulations.</li>
              <li>Treat staff, performers, and other attendees with respect and consideration.</li>
              <li>Do not engage in violence, harassment, or disruptive behavior at events.</li>
              <li>Use tickets only as permitted and do not attempt to circumvent ticketing or access controls.</li>
              <li>Provide honest and fair feedback based on actual experience when leaving reviews.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">4. Communications and Messaging</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>
                <strong>Direct Messages:</strong> Use messaging features responsibly. Do not send unwanted
                spam, harassment, or aggressive solicitation.
              </li>
              <li>
                <strong>Comments and Replies:</strong> Engage in good faith. Critique ideas and experiences,
                not people. Avoid personal attacks.
              </li>
              <li>
                <strong>Promotional Content:</strong> Clearly identify sponsored or promotional messages where
                required, and do not misrepresent commercial relationships.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">5. Reporting and Safety</h2>
            <p className="text-muted-foreground mb-2">
              If you encounter content or behavior that appears to violate these Guidelines or our Terms of
              Service, we encourage you to report it:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
              <li>
                Use in-app reporting tools where available (such as <q>Report</q> options on posts, comments,
                or profiles).
              </li>
              <li>
                Provide as much detail as possible, including why you believe the content or conduct violates
                our rules.
              </li>
              <li>
                For urgent safety concerns or illegal activity, contact local law enforcement first, then
                notify us with any available details.
              </li>
            </ol>
            <p className="text-muted-foreground mt-2">
              While we cannot review every interaction, we take reports seriously and may investigate,
              remove content, or take other enforcement actions at our discretion. We may not be able to
              share details of our internal review or actions taken.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">6. Enforcement</h2>
            <p className="text-muted-foreground mb-2">
              We may take one or more of the following actions when we believe these Guidelines or our Terms
              have been violated, or to protect the safety or integrity of the platform:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Warning notices or requests to modify or remove content</li>
              <li>Removal or limitation of specific posts, comments, or events</li>
              <li>Temporary restrictions on certain features (such as messaging or posting)</li>
              <li>Temporary account suspension</li>
              <li>Permanent account or organization bans in serious or repeated cases</li>
              <li>
                Notification to organizers, venues, or other affected parties where appropriate, and, in rare
                cases, reports to law enforcement or regulators as required by law
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Enforcement decisions are made at Liventix&apos;s discretion, taking into account the context,
              severity, and history of violations. We are not obligated to take action against any specific
              user or content, and our decision not to act in one instance does not waive our right to act in
              others.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">7. Appeals</h2>
            <p className="text-muted-foreground mb-2">
              If you believe that content removal or an account action was taken in error, you may submit an
              appeal:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
              <li>Review these Guidelines and our Terms of Service.</li>
              <li>
                Email <span className="font-mono">appeals@liventix.app</span> with:
                <ul className="list-disc pl-6 mt-1 space-y-1">
                  <li>Your account email or username</li>
                  <li>Any relevant event or content identifiers</li>
                  <li>The action taken (e.g., content removal, suspension)</li>
                  <li>A brief explanation of why you believe the action was incorrect</li>
                </ul>
              </li>
              <li>We aim to review appeals within a reasonable time, subject to volume and complexity.</li>
            </ol>
            <p className="text-muted-foreground mt-2">
              Our decisions on appeals are generally final, but we may revisit them if new information becomes
              available or if required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">8. Intellectual Property and DMCA</h2>
            <p className="text-muted-foreground mb-2">
              Only share content you have the right to use. If you believe your intellectual property has been
              used on the platform without authorization, you may contact us with sufficient detail to allow
              us to evaluate and respond, including under the Digital Millennium Copyright Act (DMCA) where
              applicable.
            </p>
            <p className="text-muted-foreground">
              Intellectual property or legal inquiries can be sent to{' '}
              <span className="font-mono">legal@liventix.app</span>.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">9. Age and Restricted Content</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>The Services are intended for users 13 years of age or older.</li>
              <li>
                Organizers must clearly disclose age restrictions (e.g., 18+, 21+) for events where required
                by law or venue policy.
              </li>
              <li>
                Organizers are responsible for enforcing age restrictions at their events, including verifying
                IDs where required.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">10. Security and Platform Integrity</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Do not attempt to bypass security measures, access other accounts, or disrupt the Services.</li>
              <li>Do not create, use, or distribute tools designed to scrape, spam, or overload the platform.</li>
              <li>
                If you discover a vulnerability or security issue, report it promptly to{' '}
                <span className="font-mono">security@liventix.app</span> and do not exploit it.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">11. Changes to These Guidelines</h2>
            <p className="text-muted-foreground">
              We may update these Community Guidelines from time to time to reflect changes in our Services,
              community, or applicable law. We will update the <q>Last updated</q> date at the top of this page
              and may provide additional notice for material changes. Your continued use of the Services after
              such changes take effect constitutes acceptance of the updated Guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-base md:text-lg font-semibold mb-2">12. Contact</h2>
            <div className="bg-muted p-4 rounded-lg text-muted-foreground space-y-1">
              <p>For questions or concerns about these Guidelines, you can contact:</p>
              <p>
                General Support: <span className="font-mono">support@liventix.app</span>
              </p>
              <p>
                Appeals: <span className="font-mono">appeals@liventix.app</span>
              </p>
              <p>
                Legal/Intellectual Property: <span className="font-mono">legal@liventix.app</span>
              </p>
              <p>
                Security: <span className="font-mono">security@liventix.app</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default CommunityGuidelines;
