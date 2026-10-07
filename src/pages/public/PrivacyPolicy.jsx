import React from "react";
import LegalPageLayout from "@/components/public/LegalPageLayout";

const LAST_UPDATED = "October 7, 2026";

function Section({ title, id, children }) {
  return (
    <section id={id}>
      <h2 className="mb-3 text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How Perk Sphere collects, uses, shares, and protects your personal data."
      lastUpdated={LAST_UPDATED}
    >
      <Section title="1. Introduction" id="introduction">
        <p>
          Perk Sphere ("we", "us", "our", or "the Platform") operates a loyalty and rewards platform accessible
          at <a href="https://perksphere.org" className="text-indigo-600 hover:underline dark:text-indigo-400">perksphere.org</a> and
          related domains. The Platform allows users to earn Points and Loyalty XP from eligible activities on
          participating online destinations, connect third-party accounts (such as Google/YouTube and X/Twitter)
          to verify identity, track eligible activities using a Perk Sphere client (browser extension or mobile
          app), build loyalty ranks and achievements, and redeem Points for available rewards.
        </p>
        <p>
          This Privacy Policy describes in detail the types of personal data we collect, the purposes for which
          we process that data, the legal bases for processing (where applicable), how data is shared, how long
          it is retained, the security measures we apply, and the rights you have over your data.
        </p>
        <p>
          By creating a Perk Sphere account, connecting a third-party service, installing a Perk Sphere client,
          or otherwise using any Perk Sphere service, you acknowledge that you have read and understood this
          Privacy Policy and consent to the data practices described herein. If you do not agree with these
          practices, you must not use Perk Sphere.
        </p>
        <p>
          This Privacy Policy applies to all users of Perk Sphere, including registered account holders and
          visitors who browse public pages without an account.
        </p>
      </Section>

      <Section title="2. Personal Data We Collect" id="data-collected">
        <p>
          We collect the following categories of personal data. Each category is described below along with the
          specific data points included and how it is obtained.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.1 Account and Profile Data</h3>
        <p>
          When you register for a Perk Sphere account, we collect:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Email address</strong> — used as your unique account identifier and for communication.</li>
          <li><strong>Password</strong> — stored exclusively as a salted cryptographic hash. We never store or
          transmit passwords in plaintext.</li>
          <li><strong>Display name</strong> — an optional name you choose to display on your profile.</li>
          <li><strong>Role assignment</strong> — whether your account is a standard user or an administrator.</li>
          <li><strong>Account status</strong> — active, suspended, or flagged for review.</li>
          <li><strong>Registration date and last login timestamp</strong> — used for security and account
          management.</li>
        </ul>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.2 Connected Service Data (OAuth)</h3>
        <p>
          When you choose to connect a third-party account to Perk Sphere, we collect the following data through
          the provider's OAuth 2.0 API:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>OAuth access token</strong> — a temporary credential that allows Perk Sphere to make
          authorized API requests to the provider on your behalf. This token is encrypted at rest using
          AES-256-GCM and is never exposed to the frontend application or shared with third parties.</li>
          <li><strong>OAuth refresh token</strong> — where the provider supplies one, a long-lived credential
          used to obtain new access tokens without requiring re-authorization. Also encrypted at rest.</li>
          <li><strong>Provider user ID</strong> — the unique identifier assigned to you by the provider (e.g.
          Google "sub" claim or X user ID). This is used as the authoritative external identity for your
          connection.</li>
          <li><strong>Provider username / display name</strong> — your public-facing name on the provider's
          platform, stored as non-sensitive metadata.</li>
          <li><strong>Provider email</strong> — where available (e.g. Google), the email address associated
          with your provider account.</li>
          <li><strong>Granted scopes</strong> — the specific permissions you granted to Perk Sphere, stored as
          a space-separated string for audit and display purposes.</li>
          <li><strong>Token expiration timestamp</strong> — when the access token expires, used to determine
          whether a refresh is needed.</li>
        </ul>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.3 Google-Specific Data</h3>
        <p>
          When you connect your Google account, Perk Sphere requests the following OAuth scopes and receives
          the corresponding data from Google APIs:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong><code>openid</code></strong> — establishes an authenticated session with Google and
          returns a unique user identifier (the "sub" claim).</li>
          <li><strong><code>email</code></strong> — returns the email address associated with your Google
          account. We use this to display which Google account is connected.</li>
          <li><strong><code>profile</code></strong> — returns your Google profile name and profile picture URL.
          We use the name as your display name for the connection.</li>
        </ul>
        <p>
          We do <strong>not</strong> request access to your Google emails, contacts, calendars, drive files,
          YouTube watch history, YouTube subscriptions, or any other Google data beyond the scopes listed above.
          We do not read, store, or transmit the contents of your Google emails, documents, or other private
          data. The access and refresh tokens obtained from Google are used solely to verify your identity at
          connection time and to maintain the connection. We do not make any posts, uploads, or modifications
          to your Google account.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.4 X (Twitter) Data</h3>
        <p>
          When you connect your X account, Perk Sphere requests the following OAuth scope:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong><code>users.read</code></strong> — allows Perk Sphere to retrieve your X user ID,
          username, and display name from the <code>GET /2/users/me</code> endpoint.</li>
        </ul>
        <p>
          We do <strong>not</strong> request permission to post tweets, like tweets, follow accounts, send direct
          messages, read your direct messages, access your followers, or perform any write actions on your X
          account. We do not request <code>offline.access</code> and therefore do not receive or store an X
          refresh token. The X access token is used only for the initial identity lookup and is then encrypted
          and stored for connection management purposes.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.5 Activity and Engagement Data</h3>
        <p>
          When you participate in eligible activities on participating destinations, and a Perk Sphere client
          (browser extension or mobile app) is installed, paired, and tracking is enabled, we collect:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Activity type</strong> — the kind of activity detected (e.g. website visit, page view,
          video watch, time spent).</li>
          <li><strong>Target destination</strong> — the website domain or social media account where the
          activity occurred.</li>
          <li><strong>Target URL</strong> — the specific page or content URL where the activity was detected.</li>
          <li><strong>Content identifier</strong> — where applicable, an identifier for the specific content
          (e.g. a video ID).</li>
          <li><strong>Duration / time spent</strong> — how long the activity lasted, used for tasks that
          require a minimum watch time.</li>
          <li><strong>Client timestamp</strong> — when the activity was detected by the client.</li>
          <li><strong>Device identifier</strong> — which paired device detected the activity.</li>
          <li><strong>Verification status</strong> — whether the activity was detected by the extension,
          verified via API, entered by an administrator, or is unverified.</li>
          <li><strong>Processing state</strong> — pending, processed, rejected, or duplicate.</li>
        </ul>
        <p>
          Activity data is only collected when all of the following conditions are met: (1) a Perk Sphere client
          is installed and paired with your account, (2) you have explicitly enabled tracking, and (3) the
          destination is classified as eligible by Perk Sphere administrators. Perk Sphere does not silently
          monitor your browsing activity. The browser extension only detects activities on domains that have
          been explicitly classified and added to the Perk Sphere system.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.6 Device and Session Data</h3>
        <p>
          When you pair a Perk Sphere client, we collect:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Device identifier</strong> — a unique ID generated for each paired client instance.</li>
          <li><strong>Pairing code</strong> — a short-lived code used to link a client to your account; expires
          after use.</li>
          <li><strong>Client type</strong> — the type of Perk Sphere client (browser extension, mobile app).</li>
          <li><strong>Pairing timestamp</strong> — when the device was paired.</li>
          <li><strong>IP address</strong> — collected at pairing time for security and fraud prevention. We do
          not retain IP addresses beyond the pairing session except where required for fraud investigation.</li>
        </ul>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.7 Points, XP, and Transaction Data</h3>
        <p>
          We maintain a ledger of all Points and Loyalty XP transactions associated with your account,
          including:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Transaction type</strong> — earned, manual credit, manual deduction, redemption, refund,
          promotion, correction, or expired.</li>
          <li><strong>Amount</strong> — the number of Points or XP adjusted.</li>
          <li><strong>Balance before and after</strong> — your balance immediately before and after each
          transaction, for audit integrity.</li>
          <li><strong>Reason and source</strong> — why the transaction occurred and what triggered it.</li>
          <li><strong>Related activity or redemption ID</strong> — links the transaction to the activity or
          reward that caused it.</li>
          <li><strong>Admin ID and note</strong> — if an administrator made a manual adjustment, which admin
          and why.</li>
        </ul>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.8 Reward Redemption Data</h3>
        <p>
          When you redeem Points for a reward, we collect:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Reward ID and name</strong> — which reward was redeemed.</li>
          <li><strong>Points spent</strong> — the number of Points deducted.</li>
          <li><strong>Redemption status</strong> — pending, approved, fulfilled, rejected, cancelled, or
          refunded.</li>
          <li><strong>Fulfilment information</strong> — any information needed to deliver the reward (e.g.
          shipping address or account details, depending on the reward type).</li>
          <li><strong>Admin notes</strong> — any notes added by an administrator during review or fulfilment.</li>
        </ul>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.9 Notification Data</h3>
        <p>
          We generate and store notifications associated with your account, including the notification type,
          title, message body, and read/unread status. These are used to inform you about rewards, activities,
          and account events.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.10 Usage and Analytics Data</h3>
        <p>
          We collect aggregated, anonymized usage statistics to understand how the Platform is used and to
          improve features. This data is not linked to your individual account. We do not use third-party
          advertising analytics SDKs. We do not sell your personal data to any third party.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">2.11 Technical and Log Data</h3>
        <p>
          When you interact with Perk Sphere, our servers automatically record:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Request timestamps and response status codes.</li>
          <li>Request IDs for troubleshooting and correlation.</li>
          <li>Error logs that may include stack traces (but not personal data or secrets).</li>
          <li>Authentication session tokens (stored as HTTP-only cookies or local storage).</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Personal Data" id="how-we-use">
        <p>
          We process your personal data for the following specific purposes:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Account creation and management:</strong> To create your account, authenticate you,
          maintain your session, and manage your profile and role.</li>
          <li><strong>Identity verification:</strong> To verify your identity when you connect a third-party
          account (Google or X) using the OAuth tokens and profile data returned by the provider.</li>
          <li><strong>Activity tracking and rewards:</strong> To detect eligible activities, verify them, award
          Points and Loyalty XP, and maintain accurate balance ledgers.</li>
          <li><strong>Loyalty progression:</strong> To calculate your loyalty rank, level, and achievements
          based on accumulated Loyalty XP.</li>
          <li><strong>Reward processing:</strong> To process reward redemptions, deduct Points, track
          fulfilment status, and deliver rewards.</li>
          <li><strong>Device management:</strong> To allow you to pair, list, and revoke Perk Sphere clients
          associated with your account.</li>
          <li><strong>Communication:</strong> To send you notifications about your account, rewards, activities,
          and important platform updates.</li>
          <li><strong>Fraud prevention and security:</strong> To detect fraudulent activity, prevent abuse,
          enforce fair use, and protect the integrity of the Points and rewards system.</li>
          <li><strong>Compliance:</strong> To comply with legal obligations and respond to lawful requests from
          authorities.</li>
          <li><strong>Platform improvement:</strong> To analyze aggregated usage patterns and improve features,
          performance, and user experience.</li>
        </ul>
        <p>
          We do not use your personal data for targeted advertising. We do not create profiles about you for
          third-party advertising networks. We do not sell or rent your personal data to any third party.
        </p>
      </Section>

      <Section title="4. Legal Basis for Processing (GDPR)" id="legal-basis">
        <p>
          For users in the European Economic Area (EEA), the United Kingdom, and other jurisdictions subject to
          the General Data Protection Regulation (GDPR), we process your personal data on the following legal
          bases:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Consent (Article 6(1)(a)):</strong> You consent to activity tracking, connected service
          data collection, and the processing practices described in this Privacy Policy when you register,
          connect a service, or enable tracking. You can withdraw consent at any time.</li>
          <li><strong>Contract (Article 6(1)(b)):</strong> Processing is necessary to provide the Perk Sphere
          services you requested, including account management, rewards, and loyalty progression.</li>
          <li><strong>Legitimate interests (Article 6(1)(f)):</strong> We process data for fraud prevention,
          security, platform improvement, and audit integrity, which are our legitimate interests in operating
          a secure and fair rewards platform.</li>
          <li><strong>Legal obligation (Article 6(1)(c)):</strong> We may process data to comply with legal
          obligations, such as responding to lawful requests from authorities.</li>
        </ul>
      </Section>

      <Section title="5. How We Share Your Personal Data" id="data-sharing">
        <p>
          We do not sell, rent, or trade your personal data. We share data only in the following specific
        circumstances:
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">5.1 Connected Service Providers</h3>
        <p>
          When you connect a third-party account (Google or X), your OAuth tokens and profile data are exchanged
          directly between Perk Sphere and the provider's API. The provider may have its own privacy policy
          that governs the data they share with us. We use this data only for the purposes described in this
          Privacy Policy.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">5.2 Participating Destinations</h3>
        <p>
          Activity verification may involve server-to-server communication with participating destinations to
          confirm that eligible activities occurred. This communication uses HMAC-signed, replay-protected
          requests and transmits only the minimum data necessary to verify the activity (activity type, target
          identifier, user identifier, and timestamp).
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">5.3 Infrastructure and Hosting Providers</h3>
        <p>
          We use trusted cloud infrastructure providers to host the Platform, store data, and provide core
          services (authentication, database, file storage, email delivery). These providers process data on
          our behalf as data processors under contractual obligations and do not use your data for their own
          purposes.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">5.4 Legal and Compliance Disclosures</h3>
        <p>
          We may disclose personal data when required by law, court order, or government regulation, or when we
          believe in good faith that disclosure is necessary to protect the rights, property, or safety of
          Perk Sphere, our users, or the public.
        </p>

        <h3 className="pt-2 text-base font-semibold text-foreground">5.5 No Sale of Data</h3>
        <p>
          We do not sell your personal data to any third party. We do not share your data with advertising
          networks, data brokers, or analytics companies for their own purposes.
        </p>
      </Section>

      <Section title="6. Cookies, Local Storage, and SDKs" id="cookies">
        <p>
          Perk Sphere uses the following local storage mechanisms:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Authentication tokens:</strong> Stored in HTTP-only cookies or local storage to maintain
          your login session across page loads. These tokens expire and are cleared on logout.</li>
          <li><strong>Theme preference:</strong> Your light/dark mode preference is stored in local storage.</li>
          <li><strong>Browser extension pairing token:</strong> A cryptographic token stored by the Perk Sphere
          browser extension to identify your paired device. This token can be revoked at any time from your
          account settings or by uninstalling the extension.</li>
        </ul>
        <p>
          We do not use third-party advertising cookies, tracking pixels, or fingerprinting technologies. We do
          not embed third-party social media widgets that track you across sites.
        </p>
      </Section>

      <Section title="7. Activity Tracking and Your Consent" id="activity-tracking">
        <p>
          Activity tracking is entirely opt-in and requires your explicit consent. Perk Sphere does not
          silently monitor your browsing. The following conditions must all be true for activity data to be
          collected:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>A Perk Sphere client (browser extension or mobile app) is installed on your device.</li>
          <li>The client is paired with your Perk Sphere account using a secure pairing code.</li>
          <li>You have explicitly enabled tracking in the client settings.</li>
          <li>The destination where the activity occurs has been classified as eligible by Perk Sphere
          administrators.</li>
        </ul>
        <p>
          You can disable tracking at any time by toggling the tracking setting in the Perk Sphere client, by
          revoking the device from your account settings, or by uninstalling the client entirely. When
          tracking is disabled, no new activity data is collected. Previously collected activity data remains
          in your transaction history for Points and XP integrity.
        </p>
      </Section>

      <Section title="8. Data Security" id="security">
        <p>
          We implement industry-standard security measures to protect your personal data, including:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Encryption at rest:</strong> OAuth access and refresh tokens are encrypted using
          AES-256-GCM (Advanced Encryption Standard with 256-bit keys in Galois/Counter Mode) before being
          stored in the database. The encryption key is stored in a secure secrets management system and is
          never exposed to the frontend application or logged.</li>
          <li><strong>Encryption in transit:</strong> All data transmitted between your browser, the Perk
          Sphere servers, and third-party APIs is encrypted using TLS (Transport Layer Security).</li>
          <li><strong>Password hashing:</strong> User passwords are stored exclusively as salted cryptographic
          hashes. We never store or transmit passwords in plaintext.</li>
          <li><strong>Row-level security:</strong> Each user's data is isolated at the database level using
          row-level security policies. Users can only access their own data; administrators can access all
          data for management purposes.</li>
          <li><strong>Service-role isolation:</strong> Sensitive operations (such as writing Points
          transactions, creating reward redemptions, and storing OAuth credentials) are performed exclusively
          by server-side code running with elevated service-role permissions. The frontend application and
          Perk Sphere clients cannot directly create or modify these records.</li>
          <li><strong>HMAC-signed communication:</strong> Trusted client connections (browser extension,
          server-to-server bridges) use HMAC-SHA256 signatures with timestamp validation and nonce-based
          replay protection to prevent tampering and replay attacks.</li>
          <li><strong>OAuth PKCE:</strong> All OAuth flows use Proof Key for Code Exchange (PKCE) with the S256
          method to prevent authorization code interception attacks.</li>
          <li><strong>Single-use OAuth state:</strong> OAuth state parameters are hashed and stored server-side,
          consumed on first use, and expire after 10 minutes to prevent CSRF and replay attacks.</li>
          <li><strong>Access controls:</strong> Administrative access is restricted to authorized administrators
          and is logged in an audit trail.</li>
        </ul>
        <p>
          No method of data transmission or storage is completely secure. While we strive to protect your
          personal data using commercially acceptable means, we cannot guarantee absolute security. In the
          event of a data breach, we will notify affected users and relevant authorities in accordance with
          applicable laws.
        </p>
      </Section>

      <Section title="9. Data Retention" id="retention">
        <p>
          We retain your personal data for as long as your account is active and for a limited period
          thereafter as described below:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Account data:</strong> Retained for as long as your account is active. When you delete
          your account, your personal data (email, profile, display name) is permanently removed within 30
          days.</li>
          <li><strong>OAuth tokens:</strong> Retained for as long as the connection is active. When you
          disconnect a service, encrypted tokens are permanently deleted and the provider's tokens are
          revoked.</li>
          <li><strong>Activity data:</strong> Retained for the lifetime of your account to maintain accurate
          Points and Loyalty XP balances. Aggregated, anonymized activity statistics may be retained
          indefinitely.</li>
          <li><strong>Transaction data:</strong> Points and XP transaction records are retained for the
          lifetime of your account for audit integrity and fraud prevention.</li>
          <li><strong>Redemption data:</strong> Retained for the lifetime of your account for fulfilment and
          refund purposes.</li>
          <li><strong>Device data:</strong> Retained for as long as the device is paired. Revoking a device
          deletes the device record and pairing token.</li>
          <li><strong>Audit logs:</strong> Retained for a minimum of 12 months for security and compliance
          purposes.</li>
          <li><strong>Log data:</strong> Server logs are retained for a maximum of 90 days for troubleshooting
          and security analysis.</li>
        </ul>
        <p>
          Where we are required to retain data for legal, accounting, or fraud-prevention purposes, we may
          retain it beyond account deletion for the minimum period required by law.
        </p>
      </Section>

      <Section title="10. Your Privacy Rights" id="your-rights">
        <p>
          Depending on your jurisdiction, you may have the following rights regarding your personal data:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Right of access:</strong> You can request a copy of the personal data we hold about you.
          Much of this data is available directly in your account dashboard (Points history, activity log,
          connected services, paired devices).</li>
          <li><strong>Right to rectification:</strong> You can request correction of inaccurate or incomplete
          personal data. You can update your display name and profile directly from your account settings.</li>
          <li><strong>Right to erasure (right to be forgotten):</strong> You can request deletion of your
          account and associated personal data. Account deletion is available from your account settings and
          processes within 30 days.</li>
          <li><strong>Right to restrict processing:</strong> You can request that we limit the processing of
          your personal data in certain circumstances.</li>
          <li><strong>Right to data portability:</strong> You can request your personal data in a structured,
          machine-readable format.</li>
          <li><strong>Right to object:</strong> You can object to certain types of processing, including
          processing based on legitimate interests.</li>
          <li><strong>Right to withdraw consent:</strong> You can withdraw consent for activity tracking and
          connected services at any time. Withdrawing consent does not affect the lawfulness of processing
          conducted before withdrawal.</li>
          <li><strong>Right to lodge a complaint:</strong> You have the right to lodge a complaint with your
          local data protection authority if you believe we have violated your privacy rights.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:privacy@perksphere.org" className="text-indigo-600 hover:underline dark:text-indigo-400">privacy@perksphere.org</a>.
          We will respond to your request within 30 days. We may need to verify your identity before processing
          your request.
        </p>
        <p>
          <strong>California residents (CCPA):</strong> California residents have the right to know what
          personal information is collected, request deletion, opt out of the sale of personal information
          (we do not sell personal information), and not be discriminated against for exercising these rights.
        </p>
      </Section>

      <Section title="11. Children's Privacy" id="children">
        <p>
          Perk Sphere is not directed at children under the age of 16. We do not knowingly collect personal
          data from children under 16. If you are a parent or guardian and believe your child has provided us
          with personal data, please contact us at{" "}
          <a href="mailto:privacy@perksphere.org" className="text-indigo-600 hover:underline dark:text-indigo-400">privacy@perksphere.org</a>{" "}
          and we will take prompt steps to delete that data.
        </p>
      </Section>

      <Section title="12. International Data Transfers" id="international-transfers">
        <p>
          Your personal data may be processed and stored on servers located in countries other than your own,
          including the United States and European Union. By using Perk Sphere, you consent to the transfer of
          your personal data to these countries. We take appropriate measures to ensure your data is protected
          in accordance with this Privacy Policy and applicable data protection laws, including standard
          contractual clauses or other lawful transfer mechanisms where required.
        </p>
      </Section>

      <Section title="13. Third-Party Links and Services" id="third-party">
        <p>
          Perk Sphere may contain links to third-party websites and services (such as participating
          destinations, Google, and X). We are not responsible for the privacy practices or content of these
          third-party services. We encourage you to review the privacy policies of any third-party service you
          interact with.
        </p>
        <p>
          When you click a link to a third-party destination from Perk Sphere, you are leaving our Platform and
          are subject to the third party's privacy policy. We do not control and are not responsible for the
          data collection practices of third-party destinations.
        </p>
      </Section>

      <Section title="14. Changes to This Privacy Policy" id="changes">
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our data practices, legal
          requirements, or Platform features. When we make changes, we will:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Update the "Last updated" date at the top of this page.</li>
          <li>Post the updated Privacy Policy on this page.</li>
          <li>Notify you of significant changes through the Platform or by email.</li>
        </ul>
        <p>
          We encourage you to review this Privacy Policy periodically. Your continued use of Perk Sphere after
          changes take effect constitutes your acceptance of the updated Privacy Policy.
        </p>
      </Section>

      <Section title="15. Contact Us" id="contact">
        <p>
          If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices,
          please contact us using any of the following methods:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Email (Privacy):</strong> <a href="mailto:privacy@perksphere.org" className="text-indigo-600 hover:underline dark:text-indigo-400">privacy@perksphere.org</a></li>
          <li><strong>Email (General Support):</strong> <a href="mailto:support@perksphere.org" className="text-indigo-600 hover:underline dark:text-indigo-400">support@perksphere.org</a></li>
          <li><strong>Website:</strong> <a href="https://perksphere.org" className="text-indigo-600 hover:underline dark:text-indigo-400">perksphere.org</a></li>
        </ul>
        <p>
          We are committed to working with you to resolve any concerns about your privacy and personal data.
        </p>
      </Section>
    </LegalPageLayout>
  );
}