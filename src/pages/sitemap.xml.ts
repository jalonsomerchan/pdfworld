import type { APIRoute } from 'astro';
import { pdfToolCategories, pdfTools } from '../data/tools';
import { locales } from '../i18n/ui';
import { getLocalizedPath } from '../i18n/utils';

const staticRoutes = ['', 'privacidad'];

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://pdfworld.alon.one');
  const paths = [
    ...locales.flatMap((lang) => staticRoutes.map((route) => getLocalizedPath(lang, route))),
    ...locales.flatMap((lang) => pdfToolCategories.map((category) => getLocalizedPath(lang, `categoria/${category.id}`))),
    ...locales.flatMap((lang) => pdfTools.map((tool) => getLocalizedPath(lang, tool.route))),
  ];

  const urls = [...new Set(paths)].map((path) => ({
    loc: new URL(path, origin).toString(),
    priority: path === '/es' || path === '/en' ? '1.0' : path.includes('/categoria/') ? '0.8' : '0.7',
  }));

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ loc, priority }) => `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    },
  );
};
