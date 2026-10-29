import { ApiError, apiRequest, statusError } from '@/lib/api-client';
import { authApi, type AuthResponse, type AuthUser } from './api';

// The signed-in session in this tab.
//
// The access token lives only in memory, so it never sits in storage where
// an injected script could copy it. The refresh token is an httpOnly cookie
// that the browser sends only to /api/auth. A page load or an expired access
// token gets a new access token from the cookie.

type SessionListener = (user: AuthUser | null) => void;
type TabMessage = { type: 'signed-in' } | { type: 'signed-out' };

// Lets a visitor who never signed in skip the refresh request on page load.
// It holds no secret; a wrong value costs one request at most.
const SIGNED_IN_HINT_KEY = 'sastrane:signed-in';
const REFRESH_LOCK_NAME = 'sastrane:auth-refresh';
const TAB_CHANNEL_NAME = 'sastrane:auth';

let accessToken: string | null = null;
let pendingRefresh: Promise<string | null> | null = null;
// Changes whenever the session ends, so a refresh that was already under way
// cannot sign the user back in after a logout.
let generation = 0;
let initialized = false;
let tabChannel: BroadcastChannel | null | undefined;
const listeners = new Set<SessionListener>();

function readSignedInHint() {
  try {
    return localStorage.getItem(SIGNED_IN_HINT_KEY) === '1';
  } catch {
    // Storage is unavailable, so the hint is unknown: ask the server.
    return true;
  }
}

function writeSignedInHint(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_HINT_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_HINT_KEY);
  } catch {
    // Without storage every page load asks the server, which still works.
  }
}

function notify(user: AuthUser | null) {
  for (const listener of listeners) listener(user);
}

function applySession(session: AuthResponse) {
  accessToken = session.accessToken;
  writeSignedInHint(true);
  notify(session.user);
}

function endSession() {
  generation += 1;
  accessToken = null;
  writeSignedInHint(false);
  notify(null);
}

function getTabChannel() {
  if (tabChannel === undefined) {
    tabChannel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(TAB_CHANNEL_NAME);
    tabChannel?.addEventListener('message', (event: MessageEvent) => {
      handleTabMessage(event.data as TabMessage);
    });
  }
  return tabChannel;
}

function tellOtherTabs(message: TabMessage) {
  getTabChannel()?.postMessage(message);
}

// All tabs share the refresh cookie, so they follow each other.
function handleTabMessage(message: TabMessage) {
  if (message.type === 'signed-out') {
    endSession();
  } else if (message.type === 'signed-in') {
    // The cookie now belongs to the new session, possibly of another user.
    refreshSession().catch(() => {});
  }
}

// Tabs take turns, so each refresh presents the newest cookie. The server
// would also accept a token rotated moments ago, but turns avoid relying on
// that.
async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request(REFRESH_LOCK_NAME, task);
  }
  return task();
}

async function requestAccessToken(): Promise<string | null> {
  const startedIn = generation;
  try {
    const session = await authApi.refresh();
    // A login or logout happened meanwhile and decides the session.
    if (startedIn !== generation) return accessToken;
    applySession(session);
    return session.accessToken;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // The cookie is missing, expired or revoked, for every tab.
      if (startedIn === generation) {
        endSession();
        tellOtherTabs({ type: 'signed-out' });
      }
      return null;
    }
    // Rate limits and network errors are temporary: keep the session.
    throw error;
  }
}

// Gets a new access token from the refresh cookie. Concurrent callers share
// one request. Resolves to null when the user is signed out.
export function refreshSession(): Promise<string | null> {
  pendingRefresh ??= withRefreshLock(requestAccessToken).finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

// Runs once when the app starts.
export async function initializeSession() {
  if (initialized) return;
  initialized = true;
  getTabChannel();

  if (!readSignedInHint()) {
    notify(null);
    return;
  }

  try {
    await refreshSession();
  } catch {
    // The server could not be reached. Show the user as signed out for now;
    // the hint stays, so the next request or page load tries again.
    if (accessToken === null) notify(null);
  }
}

export function subscribeToSession(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Called with the response of a login or email verification.
export function startSession(session: AuthResponse) {
  generation += 1;
  applySession(session);
  tellOtherTabs({ type: 'signed-in' });
}

export function signOut() {
  endSession();
  tellOtherTabs({ type: 'signed-out' });
  authApi.logout().catch(() => {
    // The session stays valid on the server until it expires, but this
    // browser no longer has an access token and the cookie is cleared on
    // the next refresh attempt.
  });
}

function withAccessToken(options: RequestInit, token: string): RequestInit {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...options, headers };
}

// A request that needs a signed-in user. When the access token has expired,
// it refreshes the token once and repeats the request.
export async function authRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    accessToken ?? (readSignedInHint() ? await refreshSession() : null);
  if (!token) throw statusError(401);

  try {
    return await apiRequest<T>(path, withAccessToken(options, token));
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }

  // Another request may have refreshed the token in the meantime.
  const nextToken =
    accessToken !== null && accessToken !== token
      ? accessToken
      : await refreshSession();
  if (!nextToken) throw statusError(401);

  return apiRequest<T>(path, withAccessToken(options, nextToken));
}
