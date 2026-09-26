This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The screens live in `src/components/onstage/`; `src/app/` holds one route per screen. Pages auto-update as you edit them.

Fonts (Inter and the caption fonts the editor offers) load from Google Fonts through a `<link>` in `src/app/layout.tsx`, not `next/font`: the export draws captions on a canvas by font family name, so the real family names must be available in the page.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

`master` deploys to GitHub Pages as a static export through `.github/workflows/deploy.yml`, which sets `NEXT_PUBLIC_STATIC_EXPORT`, `NEXT_PUBLIC_BASE_PATH=/OnStage` and `NEXT_PUBLIC_SITE_URL` (the canonical URL that metadata, the sitemap and robots.txt are built from).
