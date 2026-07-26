import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, List } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What WhoDoYaUse collects, why, who sees it, and how to get it deleted — in plain English.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    url: '/privacy',
    title: 'Privacy · WhoDoYaUse',
    description: 'What we collect, why, who sees it, and how to get it deleted.',
  },
};

const CONTACT = 'hello@whodoyause.com';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="26 July 2026"
      intro={
        <p>
          WhoDoYaUse is a small, neighbor-run tool. We collect the least we can get away with,
          we don&rsquo;t sell anything to anyone, and there are no advertising trackers on this
          site. This page describes exactly what we hold and what you can do about it.
        </p>
      }
    >
      <Section heading="What we collect">
        <p>Only two things come from you directly:</p>
        <List
          items={[
            <>
              <strong>Your email address.</strong> Used solely to send your sign-in link and to
              identify your account. We do not send marketing email.
            </>,
            <>
              <strong>Your first and last name</strong>, given at sign-up. Neighbors only ever
              see it shortened to a first name and last initial — &ldquo;Mike R.&rdquo; Your
              full name is never displayed, and your email address is never shown to anyone.
            </>,
          ]}
        />
        <p>Everything else is content you choose to publish:</p>
        <List
          items={[
            <>
              Recommendations you add — the business name, category, your note, and any contact
              details you enter for that business.
            </>,
            <>Your +1s and any note you attach to one.</>,
            <>Corrections you submit through &ldquo;Suggest an edit&rdquo;.</>,
          ]}
        />
        <p>
          We do not ask for your address, phone number, or location. There is no tracking pixel
          and no advertising network on this site.
        </p>
      </Section>

      <Section heading="What&rsquo;s public">
        <p>
          Anyone can browse and search without an account. Recommendations, +1 counts, notes,
          and the shortened name of whoever posted them are visible to everyone. That
          attribution is the point of the product — a recommendation from a named neighbor is
          worth more than an anonymous review. Treat anything you post here as public.
        </p>
        <p>
          Contact details you add describe a <em>business</em>, not you. Please don&rsquo;t
          enter someone&rsquo;s private number without asking them first.
        </p>
      </Section>

      <Section heading="Who else sees it">
        <p>We use three service providers, and no one else:</p>
        <List
          items={[
            <>
              <strong>Supabase</strong> — stores the database and handles sign-in links. Holds
              your email and name.
            </>,
            <>
              <strong>Amazon Web Services</strong> (us-east-1) — runs the site and the API.
              Server logs record search terms that returned no results, so we know which
              categories need filling, and are deleted after 30 days.
            </>,
            <>
              <strong>PostHog</strong> — product analytics, so we can tell whether people come
              back and search again. It receives your account id and your email address, plus
              which pages you view and whether you search, add, or +1. It does not receive the
              content of your recommendations.
            </>,
          ]}
        />
        <p>
          We do not sell or share your information with anyone else, and there is no
          third-party advertising on this site.
        </p>
      </Section>

      <Section heading="What&rsquo;s stored in your browser">
        <p>
          No advertising or tracking cookies. The site stores a few small values locally so it
          works properly: your sign-in session (so you stay signed in), and two flags —{' '}
          <code className="rounded bg-surface-tint px-1.5 py-0.5 text-[14px]">
            wdyu_first_visit
          </code>{' '}
          and{' '}
          <code className="rounded bg-surface-tint px-1.5 py-0.5 text-[14px]">
            wdyu_seen_users
          </code>{' '}
          — which let us count returning visitors without following you anywhere. Clearing your
          browser data removes all of them.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Recommendations and +1s stay until you or a moderator removes them — they&rsquo;re
          the shared record the neighborhood relies on. Your account details stay until you ask
          us to delete them. Server logs are deleted after 30 days.
        </p>
      </Section>

      <Section heading="Your choices">
        <List
          items={[
            <>
              <strong>Edit or delete your own notes</strong> at any time, directly on the card.
            </>,
            <>
              <strong>Remove a +1</strong> by tapping it again.
            </>,
            <>
              <strong>Delete your account and personal details.</strong> Email us and we&rsquo;ll
              do it. Tell us whether you also want your recommendations removed, or left in
              place without your name — neighbors may be relying on them.
            </>,
            <>
              <strong>Ask what we hold about you</strong> and we&rsquo;ll tell you.
            </>,
          ]}
        />
      </Section>

      <Section heading="Children">
        <p>This site isn&rsquo;t intended for anyone under 13, and we don&rsquo;t knowingly collect their information.</p>
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes in a way that affects you, we&rsquo;ll update the date at the
          top and say so in the app rather than changing it quietly.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions, deletion requests, or anything that looks wrong:{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="rounded font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {CONTACT}
          </a>
          . See also our{' '}
          <Link
            href="/terms"
            className="rounded font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            terms
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
