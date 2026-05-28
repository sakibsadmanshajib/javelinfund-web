import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Draws a receipt mirroring Glen's template layout, with the current charity address.
// signaturePngBytes: Uint8Array|null — facsimile signature, composited above the signatory line.
export async function renderReceiptPdf(model, signaturePngBytes) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const left = 56;
  let y = 740;

  const line = (text, opts = {}) => {
    page.drawText(String(text), { x: opts.x ?? left, y, size: opts.size ?? 11, font: opts.bold ? bold : font, color: ink });
    y -= opts.gap ?? 16;
  };

  line(model.charity.name, { bold: true, size: 15, gap: 20 });
  line(model.charity.address, { size: 10, gap: 14 });
  line(`Registration # ${model.charity.regNumber}`, { size: 10, gap: 26 });

  line(`Official Donation Receipt        Receipt #: ${model.serial}`, { bold: true, gap: 18 });
  line(`Date issued: ${model.dateIssued.slice(0, 10)}`, { gap: 14 });
  line(`Date donation received: ${model.dateReceived}`, { gap: 22 });

  line('Donor:', { bold: true, gap: 14 });
  line(model.donorName, { gap: 14 });
  line(model.donorAddress, { gap: 14 });
  line(`${model.cityProvince}   ${model.postalCode}`, { gap: 24 });

  line(`Cash donation`, { gap: 14 });
  line(`Total eligible amount of gift: $${model.amount}`, { bold: true, gap: 26 });

  line(model.charity.statement, { size: 10, gap: 14 });
  line(model.charity.craLine, { size: 9, gap: 40 });

  if (signaturePngBytes) {
    try {
      const png = await doc.embedPng(signaturePngBytes);
      const w = 140;
      const h = (png.height / png.width) * w;
      page.drawImage(png, { x: left, y: y - h + 10, width: w, height: h });
      y -= h;
    } catch (_) { /* if signature fails to embed, fall through to text line */ }
  }
  page.drawLine({ start: { x: left, y }, end: { x: left + 200, y }, thickness: 0.8, color: ink });
  y -= 14;
  line(model.charity.signatory, { size: 10 });

  return await doc.save(); // Uint8Array
}
