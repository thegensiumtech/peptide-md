/**
 * @type {import('next').NextConfig}
 *
 * Framing policy, which until now was absent entirely.
 *
 * Next ships no framing headers of its own, so every page here could be put
 * inside an iframe on any site. That is a clickjacking surface on the admin
 * panel and the booking flow: an attacker frames the real page invisibly over
 * their own and harvests whatever gets clicked.
 *
 * The embed route is the one deliberate exception, because being framed is its
 * entire purpose.
 */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@peptide/shared'],

  async headers() {
    return [
      {
        /**
         * The widget. Framed by whichever partner pasted it in, which we
         * cannot enumerate at build time: a partner may run several sites, and
         * the point of the scope's "adding a partner is a data task" is that
         * nobody redeploys to onboard one.
         *
         * Allowing any ancestor is safe here because the page is a public
         * booking form with nothing to steal. It reads no session, holds no
         * cookie, and every endpoint behind it is rate limited and write only.
         * Clickjacking a form that any visitor is invited to fill in achieves
         * nothing.
         */
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
          // Deliberately not X-Frame-Options: it has no "allow any" value, and
          // older browsers reading it would block the widget outright.
        ],
      },
      {
        // The loader is fetched cross-origin by the partner's page.
        source: '/v1/widget.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
      {
        // Everything else. The admin panel and the booking flow have no
        // business being inside somebody else's page.
        //
        // The negative lookahead matters: Next applies every rule whose source
        // matches, so a bare '/:path*' also matched /embed and its
        // frame-ancestors 'none' won, silently making the widget unframeable.
        source: '/:path((?!embed/|v1/widget).*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
