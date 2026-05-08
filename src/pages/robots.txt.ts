export async function GET({ site }: { site: URL }) {
  const sitemap = new URL(`${import.meta.env.BASE_URL}sitemap.xml`, site).toString();

  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${sitemap}
`,
    {
      headers: {
        'Content-Type': 'text/plain',
      },
    },
  );
}
