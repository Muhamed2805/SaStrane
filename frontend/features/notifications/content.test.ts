import { describe, expect, it } from 'vitest';
import type { Notification } from './api';
import { notificationContent } from './content';

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    type: 'INVITATION',
    listingId: 'listing-1',
    listingTitle: 'Selidba',
    actorName: 'Amra',
    readAt: null,
    createdAt: '2026-11-06T10:00:00.000Z',
    ...overrides,
  };
}

describe('notificationContent', () => {
  it('leads an invitation and a new application to the job', () => {
    expect(notificationContent(notification(), 'user-1')).toEqual({
      title: 'Novi poziv na posao',
      href: '/listings/listing-1',
    });
    expect(
      notificationContent(notification({ type: 'NEW_APPLICATION' }), 'user-1'),
    ).toEqual({
      title: 'Nova prijava na tvoj oglas',
      href: '/listings/listing-1',
    });
  });

  it('leads to the workspace once the job is deleted', () => {
    expect(
      notificationContent(notification({ listingId: null }), 'user-1').href,
    ).toBe('/inbox?tab=invitations');
    expect(
      notificationContent(
        notification({ type: 'NEW_APPLICATION', listingId: null }),
        'user-1',
      ).href,
    ).toBe('/inbox?tab=received');
  });

  it('leads a decision to the applications and a rating to the profile', () => {
    expect(
      notificationContent(
        notification({ type: 'APPLICATION_ACCEPTED' }),
        'user-1',
      ),
    ).toEqual({
      title: 'Tvoja prijava je prihvaćena',
      href: '/inbox?tab=applications',
    });
    expect(
      notificationContent(
        notification({ type: 'APPLICATION_REJECTED' }),
        'user-1',
      ).title,
    ).toBe('Tvoja prijava je odbijena');
    expect(
      notificationContent(notification({ type: 'NEW_RATING' }), 'user 1'),
    ).toEqual({
      title: 'Nova ocjena za tvoj rad',
      href: '/users/user%201',
    });
    expect(
      notificationContent(
        notification({ type: 'NEW_LISTING_MATCH', listingId: null }),
        'user 1',
      ),
    ).toEqual({ title: 'Nov oglas po tvom upozorenju', href: '/listings' });
    expect(
      notificationContent(
        notification({ type: 'NEW_CLIENT_RATING' }),
        'user 1',
      ),
    ).toEqual({
      title: 'Nova ocjena za tebe kao klijenta',
      href: '/users/user%201#client-ratings',
    });
  });
});
