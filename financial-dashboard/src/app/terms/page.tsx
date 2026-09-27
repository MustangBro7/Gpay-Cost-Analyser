import type { Metadata } from "next"
import Link from "next/link"
import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/LegalPage"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using GPay Cost Analyzer.",
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  return (
    <LegalPage
      label="Legal"
      title="Terms of Service"
      intro={
        <p>
          By signing in to GPay Cost Analyzer you agree to these terms. If you don&apos;t agree,
          please don&apos;t use the app.
        </p>
      }
      sections={[
        {
          title: "The service",
          body: (
            <p>
              GPay Cost Analyzer is a free, independent tool that reads bank payment alert emails
              from your Gmail and summarises your spending. It is not affiliated with Google, Google
              Pay, or any bank.
            </p>
          ),
        },
        {
          title: "Gmail access is required",
          body: (
            <p>
              The app only works with read-only Gmail access. If you don&apos;t grant it during
              Google sign-in, your sign-up is cancelled. You can revoke access at any time, which
              stops new transactions from being imported.
            </p>
          ),
        },
        {
          title: "Your responsibilities",
          body: (
            <ul>
              <li>Only connect a Google account that you own.</li>
              <li>Don&apos;t attempt to access other users&apos; data or disrupt the service.</li>
            </ul>
          ),
        },
        {
          title: "No financial advice, no warranty",
          body: (
            <p>
              Transactions and categories are extracted automatically and can be wrong or incomplete.
              The app is provided &ldquo;as is&rdquo; without warranties of any kind, and is not a
              substitute for your bank statements or professional financial advice. To the extent
              permitted by law, we are not liable for any loss arising from its use.
            </p>
          ),
        },
        {
          title: "Changes and termination",
          body: (
            <p>
              We may change or discontinue the app, or update these terms, at any time. You can stop
              using it and request deletion of your data as described in the{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          ),
        },
        {
          title: "Contact",
          body: (
            <p>
              Email <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
            </p>
          ),
        },
      ]}
    />
  )
}
