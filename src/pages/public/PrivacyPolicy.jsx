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

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How Perk Sphere collects, uses, and protects your data."
      lastUpdated={LAST_UPDATED}
    >
      <Section title="1. Introduction">
        <p>
          Perk Sphere ("we", "us", or "our") operates a loyalty and rewards platform that allows users to earn
          Points and Loyalty XP from eligible activities on participating online destinations, and redeem Points
          for available rewards. This Privacy Policy explains what data we collect, how we use it, and the
          choices you have.
        </p>
        <p>
          By creating an account or using any Perk Sphere service, you agree to the practices described in this
          Privacy Policy. If you do not agree, you should not use Perk Sphere.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p><strong>Account information:</strong> When you register, we collect your email address and a password
        (stored as a salted hash). You may optionally provide a display name and profile details.</p>
        <p><strong>Activity data:</strong> When you participate in eligible activities on participating
        destinations, we record activity events (such as pages visited, videos watched, or time spent) that are
        detected by a Perk Sphere client (such as the browser extension or mobile app) and submitted with your
        consent. We use this data to determine eligibility for Points and Loyalty XP.</p>
        <p><strong>Connected service data:</strong> When you connect a third-party account (such as Google/YouTube
        or X/Twitter), we receive an OAuth access token and, where available, a refresh token, along with your
        provider user ID, username, and display name. Access and refresh tokens are encrypted at rest using
        AES-256-GCM and are never exposed to the frontend or shared with third parties.</p>
        <p><strong>Device and session data:</strong> When you pair a browser extension or use a Perk Sphere
        client, we record a device identifier and pairing metadata so you can manage and revoke devices from
        your account.</p>
        <p><strong>Usage and analytics data:</strong> We collect aggregated, anonymized usage statistics to
        improve the platform. We do not sell your personal data.</p>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use your data to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Create and manage your Perk Sphere account.</li>
          <li>Track eligible activities and award Points and Loyalty XP.</li>
          <li>Determine your loyalty rank, level, and achievements.</li>
          <li>Process reward redemptions and fulfilment.</li>
          <li>Authenticate connected service accounts and verify identity.</li>
          <li>Send you notifications about your account, rewards, and activities.</li>
          <li>Detect and prevent fraud, abuse, and violations of our Terms of Service.</li>
          <li>Maintain and improve the platform's features and security.</li>
        </ul>
      </Section>

      <Section title="4. How We Share Your Information">
        <p>We do not sell your personal data. We share data only in the following circumstances:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>With your connected providers:</strong> When you connect a third-party account, we
          communicate with that provider's API using your OAuth tokens to verify your identity and retrieve
          your profile information.</li>
          <li><strong>With participating destinations:</strong> Activity verification may involve server-to-server
          communication with participating destinations to confirm eligible activities.</li>
          <li><strong>Service providers:</strong> We use trusted infrastructure and hosting providers to operate
          the platform. These providers process data on our behalf under contractual obligations.</li>
          <li><strong>Legal compliance:</strong> We may disclose data when required by law, court order, or to
          protect the rights, property, or safety of Perk Sphere, our users, or others.</li>
        </ul>
      </Section>

      <Section title="5. Cookies and Local Storage">
        <p>
          Perk Sphere uses local storage and session cookies to maintain your authentication session, remember
          your theme preference, and improve performance. We do not use third-party advertising cookies. The
          Perk Sphere browser extension stores a pairing token locally to identify your device; this token can
          be revoked at any time from your account settings.
        </p>
      </Section>

      <Section title="6. Third-Party Services">
        <p>
          Perk Sphere integrates with third-party services including Google (for Google/YouTube account
          connections) and X (formerly Twitter). When you connect these services, the provider's own privacy
          policy applies to the data they share with us. We request only the minimum scopes necessary:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Google:</strong> OpenID, email, and profile scopes — to verify your identity.</li>
          <li><strong>X/Twitter:</strong> <code>users.read</code> scope — to retrieve your X user ID and
          display name. We do not request permission to post, like, follow, or send messages on your behalf.</li>
        </ul>
        <p>
          You can disconnect any connected service at any time from the Connected Services page. Disconnecting
          revokes stored tokens and removes encrypted credentials from our system.
        </p>
      </Section>

      <Section title="7. Activity Tracking and Consent">
        <p>
          Perk Sphere does not silently monitor your browsing. Activity tracking requires a Perk Sphere client
          (such as the browser extension or mobile app) to be installed and paired with your account. The
          extension only detects activities on destinations that have been classified as eligible by Perk Sphere
          administrators, and only when you have explicitly enabled tracking. You can disable tracking or
          revoke device access at any time.
        </p>
      </Section>

      <Section title="8. Data Security">
        <p>
          We take reasonable measures to protect your data, including:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Encrypting OAuth access and refresh tokens at rest using AES-256-GCM.</li>
          <li>Using server-side row-level security to isolate each user's data.</li>
          <li>Requiring authentication for all sensitive operations.</li>
          <li>Using HMAC-signed, replay-protected communication for trusted client connections.</li>
          <li>Storing passwords as salted hashes (never in plaintext).</li>
        </ul>
        <p>
          No method of transmission or storage is completely secure. While we strive to protect your data, we
          cannot guarantee absolute security.
        </p>
      </Section>

      <Section title="9. Data Retention">
        <p>
          We retain your account data for as long as your account is active. Activity records and transaction
          history are retained to maintain accurate Points and Loyalty XP balances and for fraud prevention.
          If you delete your account, we will remove your personal data within 30 days, except where retention
          is required for legal, accounting, or fraud-prevention purposes.
        </p>
      </Section>

      <Section title="10. Your Rights">
        <p>
          Depending on your jurisdiction (including under the GDPR for EU/UK residents and the CCPA for
          California residents), you may have the following rights regarding your personal data:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong>Erasure:</strong> Request deletion of your account and associated data.</li>
          <li><strong>Restriction:</strong> Request that we limit the processing of your data.</li>
          <li><strong>Data portability:</strong> Request your data in a structured, machine-readable format.</li>
          <li><strong>Objection:</strong> Object to certain types of processing.</li>
          <li><strong>Withdrawal of consent:</strong> Withdraw consent for activity tracking or connected
          services at any time.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at <a href="mailto:privacy@perksphere.org"
          className="text-indigo-600 hover:underline dark:text-indigo-400">privacy@perksphere.org</a>.
        </p>
      </Section>

      <Section title="11. Children's Privacy">
        <p>
          Perk Sphere is not intended for children under the age of 16. We do not knowingly collect personal
          data from children under 16. If you believe a child under 16 has provided us with personal data,
          please contact us and we will take steps to delete it.
        </p>
      </Section>

      <Section title="12. International Data Transfers">
        <p>
          Your data may be processed and stored on servers located outside your country of residence. By using
          Perk Sphere, you consent to such transfers. We take appropriate measures to ensure your data is
          protected in accordance with this Privacy Policy regardless of where it is processed.
        </p>
      </Section>

      <Section title="13. Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of significant changes by
          posting the updated policy on this page and updating the "Last updated" date. We encourage you to
          review this policy periodically.
        </p>
      </Section>

      <Section title="14. Contact Us">
        <p>
          If you have questions or concerns about this Privacy Policy or our data practices, please contact us
          at <a href="mailto:privacy@perksphere.org" className="text-indigo-600 hover:underline dark:text-indigo-400">privacy@perksphere.org</a>.
        </p>
      </Section>
    </LegalPageLayout>
  );
}