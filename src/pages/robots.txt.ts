import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://pdfworld.alon.one');
  const sitemap = new URL('/sitemap.xml', origin).toString();

  return new Response(
    `User-agent: *
Allow: /
Disallow: /sw.js

Sitemap: ${sitemap}
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    },
  );
};
