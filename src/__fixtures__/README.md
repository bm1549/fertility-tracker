# Import parsing fixtures

Captured output of the app's real extraction pipeline (pdfjs-dist text
extraction and tesseract.js OCR) run against publicly published sample lab
reports, so `parseLabText` tests exercise what those libraries actually
produce instead of hand-typed idealized text.

| Fixture | Source document | What it exercises |
| --- | --- | --- |
| `zrt-fertility-report.pdf-lines.txt` | ZRT Laboratory public sample fertility profile (fictional patient), <https://www.zrtlab.com/media/1676/fertility-sample-report.pdf> | PDF text layer via `reconstructPdfLines` (current app behavior). Expected: FSH 14.4, LH 11.8, E2 60, Pgn 2.4, TSH 1.8. Contains a `Ratio: Pg/E2 40` trap line, DOB, report/print dates. |
| `zrt-fertility-report.pdf-joined.txt` | same | Legacy space-joined pdfjs text (one line per page) — parser must still find the right values with no line structure. |
| `zrt-fertility-report.ocr.txt` | same, page 1 rasterized at 2x then OCR'd | Tesseract cannot read the result values (they sit in graphics), so lines carry only reference ranges. Expected: **no values** — importing a range bound would be fabricating data. |
| `thyroid-labcorp-basic.ocr.txt` | Labcorp-style thyroid panel screenshot from <https://www.testing.com/thyroid-testing-example-results/> | OCR of a columnar report: value then reference interval then lab code. Expected TSH 1.070. |
| `thyroid-labcorp-expanded.ocr.txt` | same page | TSH row further down among many analytes. Expected TSH 2.680. |
| `thyroid-quest-basic.ocr.txt` | Quest-style report screenshot, same page | Reference-range column with extra pregnancy ranges. Expected TSH 1.70. |
| `thyroid-quest-expanded.ocr.txt` | same page | OCR dropped leading characters (`TSH` → `SH`, values garbled elsewhere). Expected TSH 3.51 via OCR normalization. |
| `portal-medication-list.ocr.txt` | Patient-portal medication table, rendered from `portal-medication-list.html` in this directory (synthetic entries, no real patient) | Negative fixture: every row is a prescription, three of them naming hormones the app tracks. Expected: **no values, no date** — the old parser read `Progesterone 200 MG Capsule` as a progesterone of 200 ng/mL and the prescription's start date as the visit date. |
| `brochure-no-results.pdf-joined.txt` | DiagnosTechs FHP patient brochure, <https://www.diagnostechs.com/wp-content/uploads/2025/02/fhp_patient.pdf> | Negative fixture: hormone names in prose plus a phone number and copyright years, but **no results**. Expected: no values. |
| `brochure-no-results.ocr.txt` | same, page 1 OCR | Negative fixture under OCR noise. Expected: no values. |

Regenerate with:

```
npm i --no-save @napi-rs/canvas
node scripts/capture-fixtures.mjs <out-dir> <sample.pdf|screenshot.png>...
```

`portal-medication-list.ocr.txt` has no published source document; screenshot
its HTML first, then feed the PNG to the same script:

```
chrome --headless --screenshot=portal-medication-list.png \
  --window-size=1120,1180 --force-device-scale-factor=2 \
  src/__fixtures__/portal-medication-list.html
```

Fixture content is test data only: the published sources above use
fictional patients, and the medication table is synthetic.
