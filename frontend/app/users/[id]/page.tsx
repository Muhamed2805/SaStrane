import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  MapPin,
  Star,
} from 'lucide-react';
import { JsonLd } from '@/components/json-ld';
import { UserAvatar } from '@/components/user-avatar';
import { InviteButton } from '@/features/invitations/components/invite-button';
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import { ReportButton } from '@/features/moderation/components/report-button';
import { PortfolioGallery } from '@/features/portfolio/components/portfolio-gallery';
import { ratingsApi } from '@/features/ratings/api';
import {
  RatingStars,
  RatingSummary,
} from '@/features/ratings/components/rating-stars';
import {
  UserClientRatings,
  UserRatings,
} from '@/features/ratings/components/user-ratings';
import {
  completedJobsLabel,
  formatAverage,
  ratingCountLabel,
  responseTimeLabel,
} from '@/features/ratings/format';
import {
  profileKeys,
  userClientRatingsQuery,
  userRatingsQuery,
} from '@/features/ratings/queries';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format-date';
import { getQueryClient } from '@/lib/query-client';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';
import { BASE_OPEN_GRAPH } from '@/lib/site';

type PageProps = {
  params: Promise<{ id: string }>;
};

// The metadata and the page share one request per render.
const getProfile = cache(async (id: string) => {
  try {
    return await ratingsApi.getProfile(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const profile = await getProfile((await params).id);
  const jobs = profile.skills.map((skill) => CATEGORY_LABELS[skill]);
  const description = [
    profile.rating.average === null
      ? `${profile.fullName} na SaStrane. Još nema ocjena.`
      : `${profile.fullName} na SaStrane: ${formatAverage(profile.rating.average)} od 5, ${ratingCountLabel(profile.rating.count)}.`,
    jobs.length > 0 ? `Poslovi: ${jobs.join(', ')}.` : null,
    profile.location ? `${LOCATION_LABELS[profile.location]}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    title: profile.fullName,
    description,
    alternates: { canonical: `/users/${profile.id}` },
    openGraph: {
      ...BASE_OPEN_GRAPH,
      type: 'profile',
      title: profile.fullName,
      description,
      url: `/users/${profile.id}`,
      // The profile photo is small and square: it shows beside the text.
      ...(profile.avatarUrl
        ? { images: [{ url: profile.avatarUrl, width: 256, height: 256 }] }
        : {}),
    },
    ...(profile.avatarUrl ? { twitter: { card: 'summary' } } : {}),
  };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getProfile(id);

  const queryClient = getQueryClient();
  queryClient.setQueryData(profileKeys.detail(profile.id), profile);
  // The first page of reviews comes with the page. A failure here leaves
  // the list to load in the browser.
  const hasClientRatings = profile.clientRating.count > 0;
  await Promise.all([
    queryClient.prefetchInfiniteQuery(userRatingsQuery(profile.id)),
    hasClientRatings
      ? queryClient.prefetchInfiniteQuery(userClientRatingsQuery(profile.id))
      : null,
  ]);

  const { average, count } = profile.rating;
  const { completedJobs, responseMinutes } = profile.stats;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto max-w-3xl space-y-6">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            dateCreated: profile.createdAt,
            mainEntity: {
              '@type': 'Person',
              name: profile.fullName,
              url: absoluteUrl(`/users/${profile.id}`),
              ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
              ...(profile.bio ? { description: profile.bio } : {}),
              ...(profile.skills.length > 0
                ? {
                    knowsAbout: profile.skills.map(
                      (skill) => CATEGORY_LABELS[skill],
                    ),
                  }
                : {}),
              ...(profile.location
                ? {
                    address: {
                      '@type': 'PostalAddress',
                      addressLocality: LOCATION_LABELS[profile.location],
                      addressCountry: 'BA',
                    },
                  }
                : {}),
            },
          }}
        />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: 'Početna', path: '/' },
            { name: 'Izvođači', path: '/executors' },
            { name: profile.fullName, path: `/users/${profile.id}` },
          ])}
        />
        <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <UserAvatar
              name={profile.fullName}
              url={profile.avatarUrl}
              className="size-16 rounded-2xl bg-primary text-2xl font-bold text-white"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight">
                {profile.fullName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {profile.location ? (
                  <p className="flex items-center gap-1.5">
                    <MapPin
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    {LOCATION_LABELS[profile.location]}
                  </p>
                ) : null}
                <p className="flex items-center gap-1.5">
                  <CalendarDays
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  Član od {formatDate(profile.createdAt)}
                </p>
                {completedJobs > 0 ? (
                  <p className="flex items-center gap-1.5">
                    <BriefcaseBusiness
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    {completedJobsLabel(completedJobs)}
                  </p>
                ) : null}
                {responseMinutes !== null ? (
                  <p className="flex items-center gap-1.5">
                    <Clock className="size-4 text-primary" aria-hidden="true" />
                    {responseTimeLabel(responseMinutes)}
                  </p>
                ) : null}
              </div>
              {hasClientRatings ? (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  Kao klijent:
                  <RatingSummary
                    rating={profile.clientRating}
                    href="#client-ratings"
                    className="text-sm"
                  />
                </p>
              ) : null}
            </div>
            <div className="rounded-xl bg-amber-50 px-5 py-4 text-center">
              {average === null ? (
                <p className="text-sm font-medium text-muted-foreground">
                  Još nema ocjena
                </p>
              ) : (
                <>
                  <p className="flex items-center justify-center gap-1.5 text-3xl font-bold">
                    <Star
                      className="size-6 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                    {formatAverage(average)}
                  </p>
                  <RatingStars score={average} className="mt-1" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ratingCountLabel(count)}
                  </p>
                </>
              )}
            </div>
          </div>

          {profile.bio || profile.skills.length > 0 ? (
            <div className="mt-6 space-y-4 border-t pt-6">
              {profile.bio ? (
                <div>
                  <h2 className="text-sm font-semibold">O meni</h2>
                  <p className="mt-1.5 text-sm leading-6 whitespace-pre-line text-muted-foreground">
                    {profile.bio}
                  </p>
                </div>
              ) : null}
              {profile.skills.length > 0 ? (
                <div>
                  <h2 className="text-sm font-semibold">Poslovi koje radi</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <li
                        key={skill}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        {CATEGORY_LABELS[skill]}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {/* Like the executor list: users with a job they do. */}
          {profile.skills.length > 0 ? (
            <InviteButton
              executorId={profile.id}
              executorName={profile.fullName}
            />
          ) : null}
        </section>
        <div className="flex justify-end">
          <ReportButton
            target={{ userId: profile.id }}
            ownerId={profile.id}
            subject={profile.fullName}
          />
        </div>

        <PortfolioGallery userId={profile.id} />

        <section aria-labelledby="ratings-title" className="space-y-3">
          <h2 id="ratings-title" className="text-lg font-bold">
            Ocjene klijenata
          </h2>
          <UserRatings userId={profile.id} />
        </section>

        {hasClientRatings ? (
          <section
            id="client-ratings"
            aria-labelledby="client-ratings-title"
            className="scroll-mt-24 space-y-3"
          >
            <h2 id="client-ratings-title" className="text-lg font-bold">
              Ocjene izvođača za ovog klijenta
            </h2>
            <UserClientRatings userId={profile.id} />
          </section>
        ) : null}
      </div>
    </HydrationBoundary>
  );
}
