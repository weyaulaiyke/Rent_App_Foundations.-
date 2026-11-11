import PDFDocument = require("pdfkit");
import path = require("node:path");

export type DocumentRow = { label: string; value: string };
export type PdfDocument = {
    title: string;
    organization: string;
    number?: string;
    subtitle?: string;
    rows: DocumentRow[];
    note?: string;
};

export function money(value: number, currency = "UGX"): string {
    return `${currency} ${value.toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;
}

export function calendarDate(value: Date): string {
    return value.toLocaleDateString("en-UG", {
        timeZone: "UTC", year: "numeric", month: "short", day: "numeric"
    });
}

export function paymentCalendarDate(value: Date): string {
    return value.toLocaleDateString("en-UG", {
        timeZone: "Africa/Kampala", year: "numeric", month: "short", day: "numeric"
    });
}

export function safeFilename(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || "REMOTE-document";
}

export async function renderPdf(input: PdfDocument): Promise<Buffer> {
    return new Promise(function(resolve, reject) {
        const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: input.title, Author: "REMOTE" } });
        const chunks: Buffer[] = [];
        doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        doc.registerFont("Regular", path.resolve(__dirname, "../../assets/fonts/DejaVuSans.ttf"));
        doc.registerFont("Bold", path.resolve(__dirname, "../../assets/fonts/DejaVuSans-Bold.ttf"));
        const left = doc.page.margins.left;
        const width = doc.page.width - left - doc.page.margins.right;
        const bottom = () => doc.page.height - doc.page.margins.bottom;

        function header() {
            doc.font("Bold").fontSize(26).fillColor("#c7a869").text("R", left, 42, { continued: true });
            doc.fontSize(15).fillColor("#153f37").text("  REMOTE");
            doc.moveDown(0.7).font("Regular").fontSize(10).fillColor("#52655b").text(input.organization);
            doc.moveDown(0.6).font("Bold").fontSize(22).fillColor("#19362f").text(input.title);
            if (input.number) doc.font("Regular").fontSize(11).text(input.number);
            if (input.subtitle) doc.moveDown(0.4).fontSize(10).fillColor("#52655b").text(input.subtitle);
            doc.moveDown(1);
            doc.strokeColor("#dce5df").moveTo(left, doc.y).lineTo(left + width, doc.y).stroke();
            doc.moveDown(1);
        }
        header();
        for (const row of input.rows) {
            const labelHeight = doc.font("Bold").fontSize(10).heightOfString(row.label, { width: width * 0.38 });
            const valueHeight = doc.font("Regular").fontSize(10).heightOfString(row.value, { width: width * 0.6 });
            const height = Math.max(labelHeight, valueHeight) + 14;
            if (doc.y + Math.min(height, 180) > bottom() - 30) { doc.addPage(); header(); }
            const y = doc.y;
            doc.font("Bold").fontSize(10).fillColor("#52655b").text(row.label, left, y, { width: width * 0.38 });
            doc.font("Regular").fillColor("#19362f").text(row.value, left + width * 0.4, y, { width: width * 0.6 });
            doc.y = Math.max(doc.y, y + height);
        }
        if (input.note) {
            if (doc.y > bottom() - 70) doc.addPage();
            doc.moveDown().font("Regular").fontSize(9).fillColor("#52655b").text(input.note, left, doc.y, { width });
        }
        doc.end();
    });
}
