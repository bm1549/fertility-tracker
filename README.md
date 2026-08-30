# Local Fertility Lab Tracker

A single-page React app for tracking fertility lab visits (FSH, LH, estradiol,
progesterone, endometrial thickness, follicle size, AFC, AMH, TSH) across
cycles — with a spreadsheet-style entry grid, per-cycle trend charts against
evidence-based reference ranges, and a plain-language guide for each hormone.

All data stays in your browser's `localStorage` on your own device. Nothing
is ever sent to a server — there's no account and no backend.

> **⚠️ Not medical advice.** This tool is for personal record-keeping and
> informational purposes only. It is not a medical device and does not
> provide medical advice, diagnosis, or treatment. Reference ranges shown
> are general population-level guidance, not a diagnosis — individual
> results vary. Always consult a qualified healthcare provider (your OB/GYN
> or reproductive endocrinologist) about your lab results, symptoms, and
> treatment decisions. This same disclaimer is shown, non-dismissibly, at
> the top and bottom of the app itself.

## Live site

Published via GitHub Pages: **https://bm1549.github.io/fertility-tracker/**

(Enable it once under repo **Settings → Pages → Source: GitHub Actions** if
it isn't already; the included workflow builds and deploys automatically on
every push to `main`.)

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```

## Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Recharts](https://recharts.org/) for the trend charts
- Deployed with [GitHub Actions](.github/workflows/deploy.yml) to GitHub Pages
