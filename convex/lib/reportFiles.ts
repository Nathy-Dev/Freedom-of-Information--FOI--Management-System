import { zipSync, strToU8 } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const xmlText = (text: string) => text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

export async function reportFile(name: string, rows: Array<Record<string, string | number>>, format: "csv" | "pdf" | "xlsx") {
  const headers = rows.length ? Object.keys(rows[0]!) : ["group"];
  const values = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
  const filename = `${name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "report"}.${format}`;
  if (format === "csv") {
    const csv = values.map((row) => row.map((value) => {
      const text = String(value);
      const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    }).join(",")).join("\r\n");
    return { filename, bytes: strToU8(csv), contentType: "text/csv;charset=utf-8" };
  }
  if (format === "xlsx") {
    const sheet = values.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value) => typeof value === "number" ? `<c><v>${Number.isFinite(value) ? value : 0}</v></c>` : `<c t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`).join("")}</row>`).join("");
    const files = {
      "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`,
    };
    return { filename, bytes: zipSync(Object.fromEntries(Object.entries(files).map(([path, content]) => [path, strToU8(content)]))), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([842, 595]);
  let position = 565;
  const text = (value: string) => value.replace(/[^ -~]/g, "?");
  for (const row of [[name], ...values]) {
    if (position < 35) { page = pdf.addPage([842, 595]); position = 565; }
    const line = row.map((value) => String(value)).join(" | ");
    for (let offset = 0; offset < Math.max(1, line.length); offset += 130) {
      if (position < 35) { page = pdf.addPage([842, 595]); position = 565; }
      page.drawText(text(line.slice(offset, offset + 130)), { x: 30, y: position, size: 9, font });
      position -= 15;
    }
  }
  return { filename, bytes: await pdf.save(), contentType: "application/pdf" };
}
