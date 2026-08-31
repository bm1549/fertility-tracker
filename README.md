# Local Fertility Lab Tracker

A single-page React app for tracking fertility monitoring visits across cycles
— with a spreadsheet-style entry grid, per-cycle trend charts against
evidence-based reference ranges, and a plain-language guide for each marker.

**Per visit:** FSH, LH, estradiol, progesterone, endometrial thickness, lead
follicle size, AFC (per ovary), AMH, TSH, blood pressure and heart rate.

**Per cycle:** the treatment context that makes those numbers readable —
cycle type (natural, letrozole/Clomid, gonadotropin IUI, IVF stim, FET prep),
medications and doses with the days they ran, trigger shot type/date/time,
luteal support, key event dates (positive OPK, IUI, retrieval, transfer), and
outcomes (eggs retrieved → mature → fertilized → blastocysts, PGT-A results,
serial beta hCG with doubling time, and how the cycle ended). A cycle
comparison table puts every cycle side by side, and the charts flag when a
cycle on medication is being read against natural-cycle reference bands.

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
