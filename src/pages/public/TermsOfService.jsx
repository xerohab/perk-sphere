import React from "react";
import LegalPageLayout from "@/components/public/LegalPageLayout";

const LAST_UPDATED = "October 7, 2026";

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function TermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="The rules and conditions for using Perk Sphere."
      lastUpdated={LAST_UPDATED}
    >
      <Section title="1. Acceptance of Terms">
        <p>
          These Terms of Service ("Terms") govern your use of Perk Sphere, a loyalty and rewards platform
          operated by Perk Sphere ("we", "us", or "our"). By creating an account or using any Perk Sphere
          service, you agree to be bound by these Terms. If you do not agree, you must not use Perk Sphere.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          Perk Sphere provides a platform that allows users to:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Earn Points and Loyalty XP from eligible activities on participating destinations.</li>
          <li>Connect third-party accounts (such as Google/YouTube and X/Twitter) to verify identity.</li>
          <li>Track eligible activities using a Perk Sphere client (browser extension or mobile app).</li>
          <li>Build loyalty ranks and unlock achievements.</li>
          <li>Redeem Points for available rewards in the Perk Sphere store.</li>
        </ul>
        <p>
          Perk Sphere is the sole authority for all Points, Loyalty XP, rewards, and achievement issuance.
          Activity eligibility, reward availability, and point values are determined by Perk Sphere
          administrators and may change at any time.
        </p>
      </Section>

      <Section title="3. Account Registration and Security">
        <p>
          To use Perk Sphere, you must register an account with a valid email address and password. You are
          responsible for:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Maintaining the confidentiality of your account credentials.</li>
          <li>All activities that occur under your account.</li>
          <li>Providing accurate and truthful information during registration.</li>
          <li>Notifying us immediately of any unauthorized use of your account.</li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate these Terms or are associated with
          fraudulent or abusive activity.
        </p>
      </Section>

      <Section title="4. Eligibility">
        <p>
          You must be at least 16 years of age to create a Perk Sphere account. By registering, you represent
          and warrant that you meet this age requirement and are legally able to enter into a binding
          agreement. If you are under 18, you represent that your parent or legal guardian has reviewed and
          agreed to these Terms on your behalf.
        </p>
      </Section>

      <Section title="5. User Responsibilities">
        <p>You agree to use Perk Sphere only for lawful purposes and to not:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Attempt to earn Points or Loyalty XP through fraudulent, automated, or deceptive means.</li>
          <li>Use bots, scripts, or other automated tools to simulate activity or manipulate the platform.</li>
          <li>Create multiple accounts to circumvent limits or gain unfair advantages.</li>
          <li>Share, sell, or transfer your account, Points, or rewards without authorization.</li>
          <li>Attempt to reverse-engineer, decompile, or otherwise extract the platform's source code or
          internal logic.</li>
          <li>Interfere with or disrupt the platform's servers, APIs, or security measures.</li>
          <li>Use the platform to harass, defraud, or harm other users or third parties.</li>
        </ul>
      </Section>

      <Section title="6. Points, Loyalty XP, and Rewards">
        <p>
          Points and Loyalty XP are virtual currencies within Perk Sphere. The following terms apply:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>No cash value:</strong> Points and Loyalty XP have no cash value and are not currency.
          They cannot be exchanged for cash except where explicitly offered as a reward.</li>
          <li><strong>Sole authority:</strong> Perk Sphere is the sole authority for awarding, adjusting, or
          revoking Points, Loyalty XP, achievements, and rewards. The browser extension and other clients never
          have reward authority.</li>
          <li><strong>Eligibility:</strong> Not all activities earn Points or Loyalty XP. Eligibility depends
          on the destination's classification, the task configuration, and your account standing.</li>
          <li><strong>Expiration:</strong> Points may expire if your account is inactive for an extended
          period. We will provide notice before expiring Points.</li>
          <li><strong>Redemptions:</strong> Reward redemptions are subject to availability, stock limits, and
          per-user limits. Some redemptions may require manual approval. Points are deducted at the time of
          redemption and may be refunded if a redemption is rejected or cancelled.</li>
          <li><strong>Adjustments:</strong> We reserve the right to adjust or reverse Points, Loyalty XP, or
          rewards that were awarded in error or through fraudulent activity.</li>
        </ul>
      </Section>

      <Section title="7. Activity Tracking and Consent">
        <p>
          Perk Sphere does not silently monitor your browsing. Activity tracking requires:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>A Perk Sphere client (browser extension or mobile app) installed and paired with your account.</li>
          <li>Your explicit consent to enable tracking on participating destinations.</li>
          <li>The destination to be classified as eligible by Perk Sphere administrators.</li>
        </ul>
        <p>
          You can disable tracking, revoke device access, or disconnect paired clients at any time from your
          account settings. Disabling tracking may affect your ability to earn Points and Loyalty XP from
          tracked activities.
        </p>
      </Section>

      <Section title="8. Connected Services">
        <p>
          Perk Sphere allows you to connect third-party accounts (Google/YouTube and X/Twitter) using OAuth
          2.0. When you connect a service:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>We request only the minimum permissions necessary to verify your identity.</li>
          <li>We do not request permission to post, like, follow, or send messages on your behalf.</li>
          <li>Access and refresh tokens are encrypted at rest and stored securely.</li>
          <li>You can disconnect a service at any time, which revokes stored tokens.</li>
        </ul>
        <p>
          Your use of connected services is also subject to the terms and policies of those providers.
        </p>
      </Section>

      <Section title="9. Acceptable Use of Rewards">
        <p>
          Rewards obtained through Perk Sphere are for personal, non-commercial use. You may not resell,
          transfer, or exchange rewards without authorization. Reward terms and conditions may be specified
          on individual reward listings and are incorporated into these Terms by reference.
        </p>
      </Section>

      <Section title="10. Intellectual Property">
        <p>
          Perk Sphere, including its name, logo, software, design, and content, is owned by or licensed to
          Perk Sphere and is protected by intellectual property laws. You may not copy, modify, distribute, or
          create derivative works from any part of the platform without our written permission.
        </p>
        <p>
          Content provided by participating destinations and third-party services remains the property of their
          respective owners.
        </p>
      </Section>

      <Section title="11. Disclaimers">
        <p>
          Perk Sphere is provided "as is" and "as available" without warranties of any kind, whether express or
          implied. We do not guarantee that:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>The platform will be uninterrupted, error-free, or secure at all times.</li>
          <li>All activities will earn Points or Loyalty XP.</li>
          <li>All rewards will be available or fulfilled as expected.</li>
          <li>Connected services will remain accessible or compatible with Perk Sphere.</li>
        </ul>
        <p>
          Your use of Perk Sphere is at your own risk.
        </p>
      </Section>

      <Section title="12. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Perk Sphere and its operators shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, or any loss of data, Points,
          rewards, or profits, arising out of or related to your use of the platform.
        </p>
        <p>
          Our total liability for any claim arising from these Terms or your use of Perk Sphere shall not
          exceed the total Points value you have redeemed through the platform in the 12 months preceding the
          claim.
        </p>
      </Section>

      <Section title="13. Indemnification">
        <p>
          You agree to indemnify and hold harmless Perk Sphere and its operators from any claims, damages,
          losses, or expenses (including reasonable legal fees) arising from your violation of these Terms,
          your misuse of the platform, or your infringement of any third-party rights.
        </p>
      </Section>

      <Section title="14. Account Suspension and Termination">
        <p>
          We reserve the right to suspend, restrict, or terminate your account at any time if:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>You violate these Terms or engage in fraudulent or abusive activity.</li>
          <li>Your account is flagged for fraud or suspicious activity.</li>
          <li>You provide false or misleading information.</li>
          <li>Your use of the platform poses a risk to other users or the platform itself.</li>
        </ul>
        <p>
          You may delete your account at any time from your account settings. Upon deletion, your personal data
          will be removed in accordance with our Privacy Policy.
        </p>
      </Section>

      <Section title="15. Changes to These Terms">
        <p>
          We may update these Terms from time to time. We will notify you of significant changes by posting the
          updated Terms on this page and updating the "Last updated" date. Your continued use of Perk Sphere
          after changes take effect constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="16. Governing Law">
        <p>
          These Terms are governed by and construed in accordance with applicable law, without regard to
          conflict of law principles. Any disputes arising from these Terms or your use of Perk Sphere shall be
          resolved through good-faith negotiation, and if not resolved, through binding arbitration or the
          courts of competent jurisdiction.
        </p>
      </Section>

      <Section title="17. Contact Us">
        <p>
          If you have questions about these Terms, please contact us at{" "}
          <a href="mailto:support@perksphere.org" className="text-indigo-600 hover:underline dark:text-indigo-400">support@perksphere.org</a>.
        </p>
      </Section>
    </LegalPageLayout>
  );
}