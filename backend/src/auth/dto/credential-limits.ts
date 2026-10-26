export const PASSWORD_MIN_LENGTH = 8;

// bcrypt only uses the first 72 bytes of a password and silently ignores the
// rest, so longer passwords are rejected instead of being cut short.
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MAX_BYTES_MESSAGE =
  'Lozinka je preduga. Dozvoljeno je najviše 72 znaka.';

export const EMAIL_MAX_LENGTH = 254;
