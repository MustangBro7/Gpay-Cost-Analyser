import type { Metadata } from "next"
import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/LegalPage"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How GPay Cost Analyzer accesses, uses, stores, and deletes your Gmail and transaction data.",
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <LegalPage
      label="Legal"
      title="Privacy Policy"
      intro={
        <p>
          GPay Cost Analyzer turns the payment alert emails in your Gmail into a private spending
          dashboard. This policy explains exactly what we read, what we keep, and how to remove it.
        </p>
      }
      sections={[
        {
          title: "What we access",
          body: (
            <>
              <p>When you sign in with Google, we request:</p>
              <ul>
                <li>
                  <strong>Your name, email address, and profile picture</strong> — to create your
                  account and show who is signed in.
                </li>
                <li>
                  <strong>Read-only Gmail access</strong> (<code>gmail.readonly</code>) — to find
                  bank payment alert emails (currently HDFC Bank UPI alerts) and read the
                  transactions in them.
                </li>
              </ul>
              <p>
                We only search for messages from bank alert senders. We never send, delete, label,
                or modify any email, and we do not read your other mail.
              </p>
            </>
          ),
        },
        {
          title: "How we use it",
          body: (
            <>
              <p>
                The text of each matching alert email is sent to Google&apos;s Gemini API to extract
                the amount, receiver, and date, and to assign a spending category. Those
                transactions power your dashboard, charts, and filters.
              </p>
              <p>
                We do not sell your data, use it for advertising, or share it with anyone except the
                service providers listed below that are needed to run the app.
              </p>
            </>
          ),
        },
        {
          title: "What we store",
          body: (
            <>
              <ul>
                <li>Your account details (name, email) and your Google connection status.</li>
                <li>Extracted transactions and your category settings.</li>
                <li>
                  A processing log of recent alert emails and the extraction result, kept so the
                  developer can diagnose and fix misclassified transactions.
                </li>
              </ul>
              <p>
                We do not store your Google password. Google access tokens are held by our sign-in
                provider and are never exposed to your browser.
              </p>
            </>
          ),
        },
        {
          title: "Service providers",
          body: (
            <ul>
              <li><strong>Clerk</strong> — sign-in and account management.</li>
              <li><strong>Cloudflare</strong> — API hosting and database/storage for your transactions.</li>
              <li><strong>Google</strong> — Gmail API access and Gemini API for transaction extraction.</li>
              <li><strong>Vercel</strong> — hosting for this website.</li>
            </ul>
          ),
        },
        {
          title: "Google API Services disclosure",
          body: (
            <p>
              GPay Cost Analyzer&apos;s use and transfer of information received from Google APIs
              adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Gmail data is used only to provide the
              spending dashboard you see, and is never used to train general-purpose AI models.
            </p>
          ),
        },
        {
          title: "Deleting your data",
          body: (
            <>
              <p>
                You can stop Gmail access at any time from your{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
                  Google Account permissions
                </a>{" "}
                page. To delete your account and every transaction we hold, email{" "}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> from the address
                you signed in with — we delete it within 30 days.
              </p>
              <p>
                If you decline Gmail access during sign-up, your sign-up is cancelled and your
                account details are deleted immediately.
              </p>
            </>
          ),
        },
        {
          title: "Contact",
          body: (
            <p>
              Questions about this policy? Email{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
            </p>
          ),
        },
      ]}
    />
  )
}
