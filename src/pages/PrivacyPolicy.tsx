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
      <div className="flex-1 overflow-auto p-6 prose prose-sm max-w-none">
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. Information We Collect</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We collect information you provide directly to us, such as when you:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Create an account or profile</li>
                <li>Purchase tickets or create events</li>
                <li>Post content or interact with events</li>
                <li>Contact us for support</li>
              </ul>
              <p>This may include your name, email address, phone number, payment information, and content you create.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. How We Use Your Information</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide and maintain our services</li>
                <li>Process transactions and send confirmations</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Analyze usage patterns to improve our services</li>
                <li>Detect and prevent fraud and abuse</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Information Sharing</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We may share your information in the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>With event organizers:</strong> When you purchase tickets or interact with events</li>
                <li><strong>With service providers:</strong> To process payments and provide technical services</li>
                <li><strong>For legal reasons:</strong> When required by law or to protect our rights</li>
                <li><strong>With your consent:</strong> When you explicitly agree to sharing</li>
              </ul>
              <p>We do not sell your personal information to third parties.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Data Security</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Encryption of sensitive data in transit and at rest</li>
                <li>Regular security assessments and updates</li>
                <li>Limited access to personal information on a need-to-know basis</li>
                <li>Secure payment processing through certified providers</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Your Rights and Choices</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access and update your account information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of promotional communications</li>
                <li>Request a copy of your personal data</li>
                <li>Report privacy concerns to our support team</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Cookies and Tracking</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Remember your preferences and settings</li>
                <li>Analyze site traffic and usage patterns</li>
                <li>Provide personalized content and features</li>
                <li>Prevent fraud and improve security</li>
              </ul>
              <p>You can control cookie settings through your browser preferences.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Children's Privacy</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Changes to This Policy</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date. We encourage you to review this policy periodically.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Contact Us</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>If you have any questions about this privacy policy or our data practices, please contact us at:</p>
              <ul className="list-none space-y-1">
                <li>Email: privacy@yardpass.com</li>
                <li>Address: [Your Business Address]</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;