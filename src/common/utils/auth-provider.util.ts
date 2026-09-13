/**
 * Non-email providers (OAuth / Hosted UI) need Cognito password provisioning for forgot-password.
 * Password signups should use `email`.
 */
export function isSsoAuthProvider(authProvider: string | undefined | null): boolean {
  if (authProvider == null || String(authProvider).trim() === '') {
    return false;
  }
  return String(authProvider).toLowerCase() !== 'email';
}
