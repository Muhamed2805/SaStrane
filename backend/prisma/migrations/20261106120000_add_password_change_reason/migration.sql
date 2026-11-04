-- A signed-in password change ends the user's other sessions.
ALTER TYPE "SessionRevocationReason" ADD VALUE 'PASSWORD_CHANGE';
