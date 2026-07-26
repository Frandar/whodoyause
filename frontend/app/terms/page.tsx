import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, List } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms',
  description:
    'The ground rules for using WhoDoYaUse — what you can post, what we moderate, and what we don’t promise.',
  alternates: { canonical: '/terms' },
  openGraph: {
    url: '/terms',
    title: 'Terms · WhoDoYaUse',
    description: 'The ground rules for using WhoDoYaUse.',
  },
};

const CONTACT = 'hello@whodoyause.com';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="26 July 2026"
      intro={
        <p>
          WhoDoYaUse is a free tool run by neighbors, for one neighborhood. These are the
          ground rules. They&rsquo;re short on purpose — if something here seems unreasonable,
          email us and we&rsquo;ll talk about it.
        </p>
      }
    >
      <Section heading="What this is">
        <p>
          A place to look up the local pros your neighbors already use, and to add the ones you
          trust. That&rsquo;s the whole product. We don&rsquo;t take bookings, handle payments,
          pass messages between you and a business, or take a cut of anything.
        </p>
      </Section>

      <Section heading="Using it">
        <p>
          Browsing and searching need no account. Adding a recommendation, leaving a note, or
          +1&rsquo;ing one requires signing in with your email, so that recommendations carry a
          real neighbor&rsquo;s name. One account per person. Use your own name — the trust
          this product runs on depends on it.
        </p>
      </Section>

      <Section heading="What you post">
        <p>
          You keep ownership of what you write. By posting it here you allow us to display it
          on the site to other neighbors. Please only post things that are true and your own to
          share:
        </p>
        <List
          items={[
            <>Recommend businesses you have actually used.</>,
            <>
              Don&rsquo;t post someone&rsquo;s private contact details without their permission.
              Business contact details are fine.
            </>,
            <>
              No spam, no self-promotion for your own business, no fake or paid-for
              recommendations, and nothing abusive, harassing, or unlawful.
            </>,
            <>Don&rsquo;t impersonate another neighbor.</>,
          ]}
        />
      </Section>

      <Section heading="Moderation">
        <p>
          The founders can remove anything that breaks the rules above, and can remove accounts
          that keep doing it. We review corrections submitted through &ldquo;Suggest an
          edit&rdquo; by hand — a suggestion never changes a live listing on its own. We
          won&rsquo;t remove a recommendation just because a business dislikes it, but if you
          believe something about your business is factually wrong, email us and we&rsquo;ll
          look into it.
        </p>
      </Section>

      <Section heading="What we don&rsquo;t promise">
        <p>
          Recommendations are neighbors&rsquo; personal opinions, not our endorsement and not
          professional advice. We don&rsquo;t verify licences, insurance, pricing, or quality of
          work, and a listing here is not a guarantee of anything. Do your own checks before
          hiring anyone, exactly as you would with a recommendation given over the fence.
        </p>
        <p>
          Any dealings you have with a business you find here are strictly between you and that
          business. The site is provided as-is, and being a free tool run by two people, it may
          occasionally be unavailable or contain out-of-date information. To the fullest extent
          the law allows, we aren&rsquo;t liable for losses arising from your use of the site or
          from anyone you hire through it. Nothing here limits liability that can&rsquo;t
          legally be limited.
        </p>
      </Section>

      <Section heading="Ending it">
        <p>
          You can stop using the site or ask us to delete your account at any time — see the{' '}
          <Link
            href="/privacy"
            className="rounded font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            privacy page
          </Link>
          . We can suspend access for anyone who repeatedly breaks these rules.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If these terms change materially, we&rsquo;ll update the date at the top and say so in
          the app. Continuing to use the site after that means you&rsquo;re happy with the
          change.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Anything at all:{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="rounded font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
