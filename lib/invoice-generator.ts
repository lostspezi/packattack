import PDFDocument from "pdfkit";
import { ICoinPurchase } from "@/models/coin-purchase";
import { IInvoiceSettings } from "@/models/invoice-settings";

interface PopulatedPurchase extends Omit<ICoinPurchase, "userId"> {
  userId: { name?: string; email: string; username?: string };
}

export async function generateInvoicePdf(
  purchase: PopulatedPurchase,
  settings: IInvoiceSettings,
  lang: "de" | "en" = "de"
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const t = translations[lang];
    const priceEur = purchase.packageSnapshot.priceEurCents / 100;
    const netAmount = priceEur / (1 + settings.taxRate / 100);
    const taxAmount = priceEur - netAmount;

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text(settings.companyName, 50, 50);
    doc.fontSize(9).font("Helvetica").fillColor("#666666");
    doc.text(
      `${settings.companyAddress.street} • ${settings.companyAddress.zip} ${settings.companyAddress.city} • ${settings.companyAddress.country}`,
      50,
      75
    );
    if (settings.taxId) {
      doc.text(`${t.taxId}: ${settings.taxId}`, 50, 88);
    }

    // Invoice title
    doc
      .fillColor("#000000")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(t.invoice, 50, 140);

    // Invoice details
    const detailsY = 180;
    doc.fontSize(10).font("Helvetica");
    doc.text(`${t.invoiceNumber}:`, 50, detailsY);
    doc.font("Helvetica-Bold").text(purchase.invoiceNumber || "", 180, detailsY);
    doc.font("Helvetica").text(`${t.invoiceDate}:`, 50, detailsY + 18);
    doc
      .font("Helvetica-Bold")
      .text(formatDate(purchase.invoiceGeneratedAt || purchase.createdAt, lang), 180, detailsY + 18);

    // Customer details
    const customerY = detailsY + 60;
    doc.fontSize(10).font("Helvetica-Bold").text(t.billedTo, 50, customerY);
    doc.font("Helvetica").fontSize(10);
    const buyerName =
      purchase.userId.name || purchase.userId.username || "User";
    doc.text(buyerName, 50, customerY + 18);
    doc.text(purchase.userId.email, 50, customerY + 32);

    // Line items table
    const tableY = customerY + 70;
    // Header row
    doc
      .fillColor("#f5f5f5")
      .rect(50, tableY, 495, 24)
      .fill();
    doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
    doc.text(t.description, 58, tableY + 7);
    doc.text(t.qty, 320, tableY + 7);
    doc.text(t.unitPrice, 370, tableY + 7);
    doc.text(t.total, 470, tableY + 7);

    // Line item
    const itemY = tableY + 30;
    doc.font("Helvetica").fontSize(10);
    const itemName = purchase.packageSnapshot.name[lang] || purchase.packageSnapshot.name.de;
    const totalCoins =
      purchase.packageSnapshot.baseCoins + purchase.packageSnapshot.bonusCoins;
    doc.text(`${itemName} (${totalCoins} ${t.coins})`, 58, itemY);
    doc.text("1", 328, itemY);
    doc.text(`${priceEur.toFixed(2)} €`, 370, itemY);
    doc.text(`${priceEur.toFixed(2)} €`, 470, itemY);

    // Separator
    doc
      .moveTo(50, itemY + 25)
      .lineTo(545, itemY + 25)
      .stroke("#dddddd");

    // Totals
    const totalsY = itemY + 40;
    doc.fontSize(10).font("Helvetica");
    doc.text(t.netAmount, 350, totalsY);
    doc.text(`${netAmount.toFixed(2)} €`, 470, totalsY);

    doc.text(`${t.vat} (${settings.taxRate}%)`, 350, totalsY + 18);
    doc.text(`${taxAmount.toFixed(2)} €`, 470, totalsY + 18);

    doc
      .moveTo(350, totalsY + 36)
      .lineTo(545, totalsY + 36)
      .stroke("#000000");

    doc.font("Helvetica-Bold").fontSize(12);
    doc.text(t.grossTotal, 350, totalsY + 44);
    doc.text(`${priceEur.toFixed(2)} €`, 466, totalsY + 44);

    // Payment note
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666666")
      .text(t.paidViaStripe, 50, totalsY + 80);

    // Footer
    const footerY = 750;
    doc.fontSize(8).fillColor("#999999");
    if (settings.footerText?.[lang]) {
      doc.text(settings.footerText[lang], 50, footerY, { width: 495, align: "center" });
    }
    if (settings.email) {
      doc.text(settings.email, 50, footerY + 14, { width: 495, align: "center" });
    }

    doc.end();
  });
}

function formatDate(date: Date, lang: string): string {
  return new Date(date).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const translations = {
  de: {
    invoice: "Rechnung",
    invoiceNumber: "Rechnungsnummer",
    invoiceDate: "Rechnungsdatum",
    billedTo: "Rechnungsempfänger",
    description: "Beschreibung",
    qty: "Menge",
    unitPrice: "Einzelpreis",
    total: "Gesamt",
    coins: "Münzen",
    netAmount: "Nettobetrag",
    vat: "USt.",
    grossTotal: "Bruttobetrag",
    paidViaStripe: "Bezahlt via Stripe • Vielen Dank für Ihren Einkauf!",
    taxId: "USt-IdNr",
  },
  en: {
    invoice: "Invoice",
    invoiceNumber: "Invoice Number",
    invoiceDate: "Invoice Date",
    billedTo: "Billed To",
    description: "Description",
    qty: "Qty",
    unitPrice: "Unit Price",
    total: "Total",
    coins: "Coins",
    netAmount: "Net Amount",
    vat: "VAT",
    grossTotal: "Gross Total",
    paidViaStripe: "Paid via Stripe • Thank you for your purchase!",
    taxId: "Tax ID",
  },
};
