/**
 * Switches for things that are built but not yet allowed to run.
 *
 * Read by both the API, which enforces them, and the website, which shows the
 * matching state. Kept apart from guide.ts because that file is generated.
 */

/**
 * The free guide's download.
 *
 * Off at Dr Jinks's request (5 October 2026): the guide needs legal review
 * before anyone is sent it. The page stays up; the form shows that the guide
 * is not yet available, and the API refuses requests and download links.
 * Turn on only once he confirms it can go live.
 */
export const GUIDE_DOWNLOAD_ENABLED = false;
