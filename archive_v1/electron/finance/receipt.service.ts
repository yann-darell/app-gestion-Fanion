import { app } from "electron";
import path from "path";
import fs from "fs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Couleurs reprenant la palette Le Fanion
const INK = rgb(0.106, 0.165, 0.29); // #1B2A4A
const SLATE = rgb(0.357, 0.42, 0.51); // #5B6B82
const LINE_COLOR = rgb(0.894, 0.878, 0.839); // #E4E0D6

interface ReceiptData {
    receiptNumber: string;
    paymentDate: string;
    studentName: string;
    matricule: string;
    className: string;
    schoolYearLabel: string;
    amount: number;
    method: string;
    totalDue: number;
    totalPaidAfter: number;
    balanceAfter: number;
}

/**
 * Formate un montant en "XXX XXX FCFA" avec des espaces normales (U+0020)
 * au lieu de toLocaleString qui insère U+202F (espace fine insécable),
 * caractère incompatible avec l'encodage WinAnsi de pdf-lib.
 */
function formatCurrency(amount: number): string {
    const rounded = Math.round(amount);
    const isNeg = rounded < 0;
    const abs = Math.abs(rounded).toString();
    // Insérer un espace normale tous les 3 chiffres depuis la droite
    const parts: string[] = [];
    for (let i = abs.length; i > 0; i -= 3) {
        parts.unshift(abs.slice(Math.max(0, i - 3), i));
    }
    return (isNeg ? "-" : "") + parts.join(" ") + " FCFA";
}

/**
 * Nettoie une chaîne de tout caractère Unicode non supporté par WinAnsi.
 * Remplace : espaces fines insécables, apostrophes typographiques,
 * tirets longs, guillemets français, etc.
 */
function sanitizeForPdf(text: string): string {
    return text
        .replace(/[\u202F\u00A0]/g, " ")       // espaces insécables → espace normale
        .replace(/[\u2018\u2019\u02BC]/g, "'")  // apostrophes typographiques → apostrophe ASCII
        .replace(/[\u201C\u201D]/g, "\"")       // guillemets anglais typographiques → guillemets ASCII
        .replace(/[\u00AB\u00BB]/g, "\"")        // guillemets français « » → guillemets ASCII
        .replace(/[\u2013]/g, "-")               // tiret demi-cadratin → tiret normal
        .replace(/[\u2014]/g, "--")              // tiret cadratin → double tiret
        .replace(/[\u2026]/g, "...");            // points de suspension typographiques → trois points
}

function translateMethod(method: string): string {
    switch (method) {
        case "cash":
            return "Espèces";
        case "mobile_money":
            return "Mobile Money";
        case "bank":
            return "Virement bancaire";
        case "cheque":
            return "Chèque";
        default:
            return method;
    }
}

function formatDate(dateStr: string): string {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

export const receiptService = {
    getReceiptsDir(): string {
        const dir = path.join(app.getPath("userData"), "receipts");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    },

    async generateReceipt(data: ReceiptData): Promise<string> {
        const pdfDoc = await PDFDocument.create();

        // Format A5 portrait (148mm x 210mm → ~420 x 595 points)
        const page = pdfDoc.addPage([420, 595]);
        const { width, height } = page.getSize();

        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const margin = 40;
        let y = height - margin;

        // --- En-tête ---
        page.drawText("COLLÈGE PRIVÉ BILINGUE LE FANION", {
            x: margin,
            y,
            size: 13,
            font: fontBold,
            color: INK
        });
        y -= 18;
        page.drawText("Établissement d'enseignement secondaire", {
            x: margin,
            y,
            size: 9,
            font: fontRegular,
            color: SLATE
        });

        // Numéro de reçu (aligné à droite)
        const receiptLabel = `N° ${data.receiptNumber}`;
        const receiptLabelWidth = fontBold.widthOfTextAtSize(receiptLabel, 12);
        page.drawText(receiptLabel, {
            x: width - margin - receiptLabelWidth,
            y: height - margin,
            size: 12,
            font: fontBold,
            color: INK
        });

        // Date (alignée à droite)
        const dateLabel = `Date : ${formatDate(data.paymentDate)}`;
        const dateLabelWidth = fontRegular.widthOfTextAtSize(dateLabel, 9);
        page.drawText(dateLabel, {
            x: width - margin - dateLabelWidth,
            y: height - margin - 18,
            size: 9,
            font: fontRegular,
            color: SLATE
        });

        // --- Ligne séparatrice ---
        y -= 20;
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: LINE_COLOR
        });

        // --- Titre central ---
        y -= 30;
        const title = "REÇU DE PAIEMENT SCOLAIRE";
        const titleWidth = fontBold.widthOfTextAtSize(title, 14);
        page.drawText(title, {
            x: (width - titleWidth) / 2,
            y,
            size: 14,
            font: fontBold,
            color: INK
        });

        const yearSub = `Année scolaire : ${sanitizeForPdf(data.schoolYearLabel)}`;
        const yearSubWidth = fontRegular.widthOfTextAtSize(yearSub, 9);
        y -= 16;
        page.drawText(yearSub, {
            x: (width - yearSubWidth) / 2,
            y,
            size: 9,
            font: fontRegular,
            color: SLATE
        });

        // --- Informations de l'élève ---
        y -= 35;
        const labelX = margin;
        const valueX = margin + 120;

        const drawRow = (label: string, value: string, bold = false) => {
            page.drawText(label, {
                x: labelX,
                y,
                size: 10,
                font: fontRegular,
                color: SLATE
            });
            page.drawText(value, {
                x: valueX,
                y,
                size: 10,
                font: bold ? fontBold : fontRegular,
                color: INK
            });
            y -= 18;
        };

        drawRow("Élève :", sanitizeForPdf(data.studentName), true);
        drawRow("Matricule :", sanitizeForPdf(data.matricule));
        drawRow("Classe :", sanitizeForPdf(data.className));

        // --- Ligne séparatrice ---
        y -= 10;
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: LINE_COLOR
        });

        // --- Détails du paiement ---
        y -= 25;
        page.drawText("DÉTAILS DU VERSEMENT", {
            x: margin,
            y,
            size: 11,
            font: fontBold,
            color: INK
        });

        y -= 22;
        drawRow("Montant versé :", formatCurrency(data.amount), true);
        drawRow("Mode de paiement :", translateMethod(data.method));

        // --- Ligne séparatrice ---
        y -= 10;
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: LINE_COLOR
        });

        // --- Situation financière ---
        y -= 25;
        page.drawText("SITUATION FINANCIÈRE", {
            x: margin,
            y,
            size: 11,
            font: fontBold,
            color: INK
        });

        y -= 22;
        drawRow("Total frais année :", formatCurrency(data.totalDue));
        drawRow("Total versé :", formatCurrency(data.totalPaidAfter));
        drawRow("Solde restant dû :", formatCurrency(Math.max(0, data.balanceAfter)), true);

        // --- Pied de page ---
        y -= 40;
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 0.5,
            color: LINE_COLOR
        });

        y -= 20;
        page.drawText("Signature et cachet de l'établissement", {
            x: margin,
            y,
            size: 9,
            font: fontRegular,
            color: SLATE
        });

        y -= 50;
        page.drawText("_______________________________", {
            x: margin,
            y,
            size: 10,
            font: fontRegular,
            color: LINE_COLOR
        });

        // Note de bas de page
        const footerText = "Ce document tient lieu de reçu officiel.";
        const footerWidth = fontRegular.widthOfTextAtSize(footerText, 8);
        page.drawText(footerText, {
            x: (width - footerWidth) / 2,
            y: margin,
            size: 8,
            font: fontRegular,
            color: SLATE
        });

        // Sauvegarder le PDF
        const pdfBytes = await pdfDoc.save();
        const fileName = `${data.receiptNumber}.pdf`;
        const filePath = path.join(this.getReceiptsDir(), fileName);
        fs.writeFileSync(filePath, pdfBytes);

        return filePath;
    }
};

export default receiptService;
