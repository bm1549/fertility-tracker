// Captures real extraction output from sample lab reports so tests exercise
// what pdfjs/tesseract actually produce, not idealized hand-typed text.
//
// Usage:
//   node scripts/capture-fixtures.mjs <out-dir> <file.pdf|file.png|file.jpg>...
//
// For each PDF, writes:
//   <name>.pdfjs-joined.txt  - text items joined with spaces (legacy app behavior)
//   <name>.pdfjs-lines.txt   - text reconstructed into lines by Y coordinate
//   <name>.page1.png         - page 1 rasterized at 2x (OCR input)
// For each image (and each rasterized page), writes:
//   <name>.ocr.txt           - raw tesseract.js output
//
// Requires @napi-rs/canvas for rasterization: npm i --no-save @napi-rs/canvas

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const [outDir, ...files] = process.argv.slice(2);
if (!outDir || files.length === 0) {
  console.error("usage: node scripts/capture-fixtures.mjs <out-dir> <files...>");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });

const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { reconstructPdfLines } = await import("../src/utils.js");

async function rasterizePage(page, scale = 2) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.encode("png");
}

async function ocr(input, tag) {
  const Tesseract = (await import("tesseract.js")).default;
  const { data } = await Tesseract.recognize(input, "eng");
  console.log(`  ocr done: ${tag} (${data.text.length} chars)`);
  return data.text;
}

for (const file of files) {
  const name = basename(file, extname(file)).replace(/[^A-Za-z0-9_-]+/g, "-");
  const ext = extname(file).toLowerCase();
  console.log(`processing ${file}`);
  if (ext === ".pdf") {
    const data = new Uint8Array(await readFile(file));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let joined = "";
    let lined = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      joined += content.items.map((it) => it.str).join(" ") + "\n";
      lined += reconstructPdfLines(content.items) + "\n";
    }
    await writeFile(join(outDir, `${name}.pdfjs-joined.txt`), joined);
    await writeFile(join(outDir, `${name}.pdfjs-lines.txt`), lined);
    const png = await rasterizePage(await pdf.getPage(1));
    const pngPath = join(outDir, `${name}.page1.png`);
    await writeFile(pngPath, png);
    await writeFile(join(outDir, `${name}.page1.ocr.txt`), await ocr(pngPath, `${name}.page1`));
  } else {
    await writeFile(join(outDir, `${name}.ocr.txt`), await ocr(file, name));
  }
}
console.log("done");
