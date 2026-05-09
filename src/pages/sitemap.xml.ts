import { pdfTools } from '../data/tools';
import { locales } from '../i18n/ui';
import { getLocalizedPath } from '../i18n/utils';

const pages = ['', ...pdfTools.filter((tool) => tool.status === 'available').map((tool) => tool.route)];

export async function GET({ site }: { site: URL }) {
  const urls = pages.flatMap((page) =>
    locales.map((lang) => new URL(getLocalizedPath(lang, page), site).toString()),
  );

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
  </url>`,
  )
  .join('\n')}
</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml',
      },
    },
  );
}
