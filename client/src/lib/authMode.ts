/**
 * Sign-in switch.
 *
 * false → no sign-in: the landing page is skipped and the canvas opens as a
 *         local guest. Boards are kept in this browser only (localStorage);
 *         cloud save, sharing, live collaboration, the Boards menu and the
 *         admin / facilitator views are unavailable. AI runs still work.
 * true  → the original behaviour: landing page + Google sign-in (Firebase).
 *
 * The Firebase sign-in code is left in place — flip this back to true to
 * restore it.
 */
export const SIGN_IN_ENABLED = true;
