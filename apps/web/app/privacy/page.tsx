export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective date: &lt;UNSPECIFIED&gt;</p>
      <div className="mt-8 space-y-5 text-sm leading-6">
        <p>
          MeetingEconomy uses calendar metadata, attendee email addresses, organization settings, role bands, and optional
          employee compensation data to calculate aggregate meeting costs and meeting waste signals.
        </p>
        <p>
          We do not store meeting recordings or transcripts. Individual salaries are never exposed in application API
          responses; compensation data is used only to compute aggregate meeting economics.
        </p>
        <p>
          Calendar integrations use Google Calendar and Microsoft Graph OAuth scopes for read-only calendar access.
          Integration tokens are encrypted before storage.
        </p>
        <p>
          Meeting summary generation sends the structured notes you provide to the configured AI provider. Do not submit
          confidential content unless your organization has approved that provider configuration.
        </p>
        <p>
          Contact: &lt;UNSPECIFIED&gt;
        </p>
      </div>
    </main>
  );
}
