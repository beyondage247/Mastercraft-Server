import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import PDFDocument = require('pdfkit');
import puppeteer from 'puppeteer-core';
import { colors, company } from './pdf.constants';
import {
  InvoicePdfData,
  PdfDocumentLineItem,
  PdfPaymentLogRow,
  PdfPaymentScheduleRow,
  QuotePdfData,
} from './pdf.types';

const PAGE_MARGIN = 50;
const QUOTE_TEMPLATE_FILE = 'quote.html';
const INVOICE_TEMPLATE_FILE = 'invoice.html';
const QUOTE_FIRST_PAGE_ITEM_LIMIT = 14;
const QUOTE_CONTINUATION_PAGE_ITEM_LIMIT = 22;
const QUOTE_LOGO_URL =
  'https://res.cloudinary.com/dqe4xzwoe/image/upload/v1781173265/Others/WhatsApp_Image_2026-06-10_at_8.31.44_PM-removebg-preview_gs9jtl.png';
const DEFAULT_BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

type DocLabel = 'Quote' | 'Invoice';

interface TextLine {
  text: string;
  font?: 'Helvetica' | 'Helvetica-Bold';
  size?: number;
  color?: string;
  gap?: number;
  align?: 'left' | 'right' | 'center';
}

interface DocumentMeta {
  docLabel: DocLabel;
  docNumber: string;
  dateIssued: string;
}

interface QuoteTemplateLineItem {
  productName: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

interface QuoteTemplateSummaryCard {
  label: string;
  value: string;
  secondary: string | null;
  isAmount: boolean;
}

interface QuoteTemplateAdjustmentRow {
  label: string;
  amount: string;
}

interface QuoteTemplatePaymentRow {
  name: string;
  meta: string;
  amount: string;
}

interface QuoteTemplateNote {
  title: string;
  body: string;
}

interface QuoteTemplateContinuationPage {
  pageNumber: number;
  items: QuoteTemplateLineItem[];
  showSubtotal: boolean;
  showFinalSection: boolean;
}

interface QuoteTemplateData {
  title: string;
  logoUrl: string;
  company: typeof company;
  docNumber: string;
  dateIssued: string;
  projectName: string;
  introText: string;
  customerName: string;
  customerCompany: string | null;
  customerEmail: string;
  customerPhone: string | null;
  customerLocation: string | null;
  generatedOn: string;
  total: string;
  summaryCards: QuoteTemplateSummaryCard[];
  firstPageItems: QuoteTemplateLineItem[];
  showSubtotalOnFirstPage: boolean;
  showFinalSectionOnFirstPage: boolean;
  continuationPages: QuoteTemplateContinuationPage[];
  subtotal: string;
  adjustmentRows: QuoteTemplateAdjustmentRow[];
  paymentRows: QuoteTemplatePaymentRow[];
  notes: QuoteTemplateNote[];
  hasNotes: boolean;
  totalPages: number;
}

interface InvoiceTemplatePaymentRow {
  name: string;
  meta: string;
  amount: string;
}

interface InvoiceTemplateData {
  title: string;
  logoUrl: string;
  company: typeof company;
  docNumber: string;
  dateIssued: string;
  projectName: string;
  introText: string;
  customerName: string;
  customerCompany: string | null;
  customerEmail: string;
  customerPhone: string | null;
  customerLocation: string | null;
  generatedOn: string;
  total: string;
  summaryCards: QuoteTemplateSummaryCard[];
  firstPageItems: QuoteTemplateLineItem[];
  showSubtotalOnFirstPage: boolean;
  showFinalSectionOnFirstPage: boolean;
  continuationPages: QuoteTemplateContinuationPage[];
  subtotal: string;
  adjustmentRows: QuoteTemplateAdjustmentRow[];
  paymentRows: InvoiceTemplatePaymentRow[];
  payments: PdfPaymentLogRow[];
  hasPayments: boolean;
  notes: QuoteTemplateNote[];
  hasNotes: boolean;
  totalPages: number;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

@Injectable()
export class PdfService {
  private quoteTemplatePromise?: Promise<Handlebars.TemplateDelegate<QuoteTemplateData>>;
  private invoiceTemplatePromise?: Promise<
    Handlebars.TemplateDelegate<InvoiceTemplateData>
  >;

  async generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
    const html = await this.renderQuoteHtml(data);
    return this.renderHtmlPdf(html);
  }

  async generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
    const html = await this.renderInvoiceHtml(data);
    return this.renderHtmlPdf(html);
  }

  private async render(
    docLabel: DocLabel,
    data: QuotePdfData | InvoicePdfData,
    drawExtra: (doc: PDFKit.PDFDocument, meta: DocumentMeta) => void,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const meta: DocumentMeta = {
      docLabel,
      docNumber: data.docNumber,
      dateIssued: data.dateIssued,
    };

    this.drawHeader(doc, meta);
    this.drawTitle(doc, docLabel, data);
    this.drawSummary(doc, docLabel, data);
    this.drawLineItems(doc, meta, data.lineItems, data.subtotal);
    this.drawTotals(doc, data, meta);
    if (data.message) this.drawNote(doc, 'Message', data.message, meta);
    if (docLabel === 'Quote' && data.clientComment) {
      this.drawNote(doc, 'Client Response', data.clientComment, meta);
    }
    drawExtra(doc, meta);

    doc.end();
    return done;
  }

  private async renderQuoteHtml(data: QuotePdfData): Promise<string> {
    const template = await this.getQuoteTemplate();
    return template(this.buildQuoteTemplateData(data));
  }

  private async renderInvoiceHtml(data: InvoicePdfData): Promise<string> {
    const template = await this.getInvoiceTemplate();
    return template(this.buildInvoiceTemplateData(data));
  }

  private async getQuoteTemplate() {
    if (!this.quoteTemplatePromise) {
      this.quoteTemplatePromise = this.loadQuoteTemplate();
    }

    return this.quoteTemplatePromise;
  }

  private async getInvoiceTemplate() {
    if (!this.invoiceTemplatePromise) {
      this.invoiceTemplatePromise = this.loadInvoiceTemplate();
    }

    return this.invoiceTemplatePromise;
  }

  private async loadQuoteTemplate() {
    const templatePath = this.resolveTemplatePath(QUOTE_TEMPLATE_FILE);
    const templateSource = await readFile(templatePath, 'utf8');
    return Handlebars.compile<QuoteTemplateData>(templateSource);
  }

  private async loadInvoiceTemplate() {
    const templatePath = this.resolveTemplatePath(INVOICE_TEMPLATE_FILE);
    const templateSource = await readFile(templatePath, 'utf8');
    return Handlebars.compile<InvoiceTemplateData>(templateSource);
  }

  private resolveTemplatePath(filename: string) {
    const candidates = [
      join(process.cwd(), 'src', 'services', 'templates', filename),
      join(__dirname, '..', 'templates', filename),
    ];

    const templatePath = candidates.find((candidate) => existsSync(candidate));
    if (!templatePath) {
      throw new Error(`Could not locate template file: ${filename}`);
    }

    return templatePath;
  }

  private buildQuoteTemplateData(data: QuotePdfData): QuoteTemplateData {
    const lineItems = data.lineItems.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? '-',
      amount: item.amount ?? 'TBD',
    }));

    const firstPageItems = lineItems.slice(0, QUOTE_FIRST_PAGE_ITEM_LIMIT);
    const continuationChunks = chunkArray(
      lineItems.slice(QUOTE_FIRST_PAGE_ITEM_LIMIT),
      QUOTE_CONTINUATION_PAGE_ITEM_LIMIT,
    );

    const continuationPages = continuationChunks.map((items, index) => ({
      pageNumber: index + 2,
      items,
      showSubtotal: index === continuationChunks.length - 1,
      showFinalSection: index === continuationChunks.length - 1,
    }));

    const summaryCards = this.buildQuoteSummaryCards(data);
    const adjustmentRows = this.buildAdjustmentRows(data);
    const paymentRows = this.buildQuotePaymentRows(data);
    const notes = this.buildQuoteNotes(data);
    const totalPages = continuationPages.length + 1;

    return {
      title: `Quote #${data.docNumber} - ${company.name}`,
      logoUrl: QUOTE_LOGO_URL,
      company,
      docNumber: data.docNumber,
      dateIssued: data.dateIssued,
      projectName: data.projectName,
      introText: 'We look forward to working with you.',
      customerName: data.clientName,
      customerCompany: data.clientCompany,
      customerEmail: data.clientEmail,
      customerPhone: data.clientPhone,
      customerLocation: data.projectLocation,
      generatedOn: this.formatCurrentDate(),
      total: data.total,
      summaryCards,
      firstPageItems,
      showSubtotalOnFirstPage: continuationPages.length === 0,
      showFinalSectionOnFirstPage: continuationPages.length === 0,
      continuationPages,
      subtotal: data.subtotal,
      adjustmentRows,
      paymentRows,
      notes,
      hasNotes: notes.length > 0,
      totalPages,
    };
  }

  private buildInvoiceTemplateData(data: InvoicePdfData): InvoiceTemplateData {
    const lineItems = data.lineItems.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? '-',
      amount: item.amount ?? 'TBD',
    }));

    const firstPageItems = lineItems.slice(0, QUOTE_FIRST_PAGE_ITEM_LIMIT);
    const continuationChunks = chunkArray(
      lineItems.slice(QUOTE_FIRST_PAGE_ITEM_LIMIT),
      QUOTE_CONTINUATION_PAGE_ITEM_LIMIT,
    );

    const continuationPages = continuationChunks.map((items, index) => ({
      pageNumber: index + 2,
      items,
      showSubtotal: index === continuationChunks.length - 1,
      showFinalSection: index === continuationChunks.length - 1,
    }));

    const totalPages = continuationPages.length + 1;
    const notes = this.buildInvoiceNotes(data);

    return {
      title: `Invoice #${data.docNumber} - ${company.name}`,
      logoUrl: QUOTE_LOGO_URL,
      company,
      docNumber: data.docNumber,
      dateIssued: data.dateIssued,
      projectName: data.projectName,
      introText: `Payment due by ${data.validUntil}.`,
      customerName: data.clientName,
      customerCompany: data.clientCompany,
      customerEmail: data.clientEmail,
      customerPhone: data.clientPhone,
      customerLocation: data.projectLocation,
      generatedOn: this.formatCurrentDate(),
      total: data.total,
      summaryCards: this.buildInvoiceSummaryCards(data),
      firstPageItems,
      showSubtotalOnFirstPage: continuationPages.length === 0,
      showFinalSectionOnFirstPage: continuationPages.length === 0,
      continuationPages,
      subtotal: data.subtotal,
      adjustmentRows: this.buildAdjustmentRows(data),
      paymentRows: this.buildInvoicePaymentRows(data),
      payments: data.payments,
      hasPayments: data.payments.length > 0,
      notes,
      hasNotes: notes.length > 0,
      totalPages,
    };
  }

  private buildQuoteSummaryCards(data: QuotePdfData) {
    const scheduleCards = data.paymentSchedule
      .slice(0, 2)
      .map<QuoteTemplateSummaryCard>((item) => ({
        label: item.name,
        value: item.amount,
        secondary: this.buildScheduleMeta(item.dueDate, item.percentage),
        isAmount: true,
      }));

    while (scheduleCards.length < 2) {
      if (scheduleCards.length === 0) {
        scheduleCards.push({
          label: 'Valid Until',
          value: data.validUntil,
          secondary: 'Quote expiration',
          isAmount: false,
        });
        continue;
      }

      scheduleCards.push({
        label: 'Total',
        value: data.total,
        secondary: 'Quoted amount',
        isAmount: true,
      });
    }

    return scheduleCards;
  }

  private buildInvoiceSummaryCards(data: InvoicePdfData) {
    return [
      {
        label: 'Amount Paid',
        value: data.amountPaid,
        secondary: 'Received payments',
        isAmount: true,
      },
      {
        label: 'Balance Due',
        value: data.balanceDue,
        secondary: `Due ${data.validUntil}`,
        isAmount: true,
      },
    ] satisfies QuoteTemplateSummaryCard[];
  }

  private buildAdjustmentRows(data: QuotePdfData | InvoicePdfData) {
    const rows: QuoteTemplateAdjustmentRow[] = [];

    if (data.showTax) rows.push({ label: data.taxLabel, amount: data.taxAmount });
    if (data.showDiscount) {
      rows.push({ label: 'Discount', amount: `-${data.discount}` });
    }
    if (data.showShippingFee) {
      rows.push({ label: 'Shipping', amount: data.shippingFee });
    }

    return rows;
  }

  private buildQuotePaymentRows(data: QuotePdfData) {
    if (!data.paymentSchedule.length) {
      return [
        {
          name: 'Payment',
          meta: `Due ${data.validUntil}`,
          amount: data.total,
        },
      ];
    }

    return data.paymentSchedule.map<QuoteTemplatePaymentRow>((item) => ({
      name: item.name,
      meta: this.buildScheduleMeta(item.dueDate, item.percentage),
      amount: item.amount,
    }));
  }

  private buildInvoicePaymentRows(data: InvoicePdfData) {
    return [
      {
        name: 'Amount Paid',
        meta: 'Received payments',
        amount: data.amountPaid,
      },
      {
        name: 'Balance Due',
        meta: `Due ${data.validUntil}`,
        amount: data.balanceDue,
      },
    ] satisfies InvoiceTemplatePaymentRow[];
  }

  private buildQuoteNotes(data: QuotePdfData) {
    const notes: QuoteTemplateNote[] = [];

    if (data.message) {
      notes.push({ title: 'Message', body: data.message });
    }
    if (data.clientComment) {
      notes.push({ title: 'Client Response', body: data.clientComment });
    }

    return notes;
  }

  private buildInvoiceNotes(data: InvoicePdfData) {
    const notes: QuoteTemplateNote[] = [];

    if (data.message) {
      notes.push({ title: 'Message', body: data.message });
    }

    return notes;
  }

  private buildScheduleMeta(dueDate: string, percentage: string) {
    const dueText =
      dueDate && dueDate.toLowerCase().startsWith('on ')
        ? dueDate
        : `Due ${dueDate}`;

    return [percentage, dueText].filter(Boolean).join(' | ');
  }

  private formatCurrentDate() {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());
  }

  private resolveBrowserExecutablePath() {
    const configuredPaths = [
      process.env.PDF_BROWSER_PATH,
      process.env.PUPPETEER_EXECUTABLE_PATH,
      process.env.CHROME_PATH,
      process.env.GOOGLE_CHROME_BIN,
    ].filter((value): value is string => Boolean(value));

    return [...configuredPaths, ...DEFAULT_BROWSER_PATHS].find((candidate) =>
      existsSync(candidate),
    );
  }

  private async renderHtmlPdf(html: string): Promise<Buffer> {
    const executablePath = this.resolveBrowserExecutablePath();
    if (!executablePath) {
      throw new Error(
        'No Chrome or Edge executable was found for quote HTML-to-PDF rendering. Set PDF_BROWSER_PATH to a valid browser binary.',
      );
    }

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.emulateMediaType('screen');
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForNetworkIdle();
      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
        printBackground: true,
        preferCSSPageSize: true,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private contentWidth(doc: PDFKit.PDFDocument) {
    return doc.page.width - PAGE_MARGIN * 2;
  }

  /** Adds a new page (redrawing the document header) if `height` won't fit before the bottom margin. Returns true if a page break occurred. */
  private ensureSpace(
    doc: PDFKit.PDFDocument,
    height: number,
    meta?: DocumentMeta,
  ): boolean {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + height > bottom) {
      doc.addPage();
      if (meta) this.drawHeader(doc, meta);
      return true;
    }
    return false;
  }

  private writeLines(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    lines: TextLine[],
  ): number {
    let cursorY = y;
    for (const line of lines) {
      doc
        .font(line.font ?? 'Helvetica')
        .fontSize(line.size ?? 10)
        .fillColor(line.color ?? colors.dark)
        .text(line.text, x, cursorY, { width, align: line.align ?? 'left' });
      cursorY = doc.y + (line.gap ?? 2);
    }
    return cursorY;
  }

  private drawHeader(doc: PDFKit.PDFDocument, meta: DocumentMeta) {
    const top = doc.y;
    const width = this.contentWidth(doc);
    const rightWidth = 200;
    const rightX = PAGE_MARGIN + width - rightWidth;

    const leftBottom = this.writeLines(doc, PAGE_MARGIN, top, width - rightWidth - 20, [
      { text: company.name, font: 'Helvetica-Bold', size: 13, gap: 4 },
      { text: company.addressLine1, size: 9, color: colors.muted },
      { text: company.addressLine2, size: 9, color: colors.muted },
      {
        text: `${company.email} | ${company.phone}`,
        size: 9,
        color: colors.muted,
      },
    ]);

    const rightBottom = this.writeLines(doc, rightX, top, rightWidth, [
      {
        text: `${meta.docLabel} #${meta.docNumber}`,
        font: 'Helvetica-Bold',
        size: 12,
        align: 'right',
        gap: 4,
      },
      {
        text: 'Issue date',
        font: 'Helvetica-Bold',
        size: 9,
        align: 'right',
      },
      { text: meta.dateIssued, size: 9, color: colors.muted, align: 'right' },
    ]);

    doc.y = Math.max(leftBottom, rightBottom) + 8;
    doc.rect(PAGE_MARGIN, doc.y, width, 3).fill(colors.red);
    doc.y += 18;
    doc.fillColor(colors.dark);
  }

  private drawTitle(
    doc: PDFKit.PDFDocument,
    docLabel: DocLabel,
    data: QuotePdfData | InvoicePdfData,
  ) {
    const width = this.contentWidth(doc);
    const subtitle =
      docLabel === 'Quote'
        ? `We look forward to working with you. Valid until ${data.validUntil}.`
        : `Generated from quote ${(data as InvoicePdfData).quoteId}. Payment due by ${data.validUntil}.`;

    doc.y = this.writeLines(doc, PAGE_MARGIN, doc.y, width, [
      { text: data.projectName, font: 'Helvetica-Bold', size: 22, gap: 4 },
      { text: subtitle, size: 10, color: colors.muted, gap: 0 },
    ]);

    doc.y += 12;
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + width, doc.y)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();
    doc.y += 16;
  }

  private drawSummary(
    doc: PDFKit.PDFDocument,
    docLabel: DocLabel,
    data: QuotePdfData | InvoicePdfData,
  ) {
    const width = this.contentWidth(doc);
    const colWidth = width / 3;
    const top = doc.y;

    const customerLines: TextLine[] = [
      { text: 'CUSTOMER', font: 'Helvetica-Bold', size: 8, color: colors.muted, gap: 6 },
      { text: data.clientName, font: 'Helvetica-Bold', size: 11, gap: 3 },
    ];
    if (data.clientCompany) {
      customerLines.push({ text: data.clientCompany, size: 9, color: colors.muted });
    }
    customerLines.push({ text: data.clientEmail, size: 9, color: colors.muted });
    if (data.clientPhone) {
      customerLines.push({ text: data.clientPhone, size: 9, color: colors.muted });
    }
    if (data.projectLocation) {
      customerLines.push({ text: data.projectLocation, size: 9, color: colors.muted });
    }

    const detailLines: TextLine[] = [
      {
        text: docLabel === 'Quote' ? 'QUOTE DETAILS' : 'INVOICE DETAILS',
        font: 'Helvetica-Bold',
        size: 8,
        color: colors.muted,
        gap: 6,
      },
      { text: `Date issued: ${data.dateIssued}`, size: 9, color: colors.muted },
      {
        text:
          docLabel === 'Quote'
            ? `Valid until: ${data.validUntil}`
            : `Due: ${data.validUntil}`,
        size: 9,
        color: colors.muted,
      },
    ];

    const totalLines: TextLine[] = [
      {
        text: docLabel === 'Quote' ? 'TOTAL' : 'TOTAL DUE',
        font: 'Helvetica-Bold',
        size: 8,
        color: colors.muted,
        align: 'right',
        gap: 6,
      },
      {
        text: data.total,
        font: 'Helvetica-Bold',
        size: 18,
        align: 'right',
      },
    ];

    const customerBottom = this.writeLines(
      doc,
      PAGE_MARGIN,
      top,
      colWidth - 16,
      customerLines,
    );
    const detailBottom = this.writeLines(
      doc,
      PAGE_MARGIN + colWidth,
      top,
      colWidth - 16,
      detailLines,
    );
    const totalBottom = this.writeLines(
      doc,
      PAGE_MARGIN + colWidth * 2,
      top,
      colWidth,
      totalLines,
    );

    doc.y = Math.max(customerBottom, detailBottom, totalBottom) + 6;
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + width, doc.y)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();
    doc.y += 16;
  }

  private lineItemColumns(doc: PDFKit.PDFDocument) {
    const width = this.contentWidth(doc);
    const qtyWidth = 50;
    const priceWidth = 85;
    const amountWidth = 85;
    const itemWidth = width - qtyWidth - priceWidth - amountWidth;

    return {
      item: { x: PAGE_MARGIN, width: itemWidth },
      qty: { x: PAGE_MARGIN + itemWidth, width: qtyWidth },
      price: { x: PAGE_MARGIN + itemWidth + qtyWidth, width: priceWidth },
      amount: {
        x: PAGE_MARGIN + itemWidth + qtyWidth + priceWidth,
        width: amountWidth,
      },
    };
  }

  private drawLineItemsHeader(doc: PDFKit.PDFDocument) {
    const cols = this.lineItemColumns(doc);
    const y = doc.y;

    doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.muted);
    doc.text('ITEM', cols.item.x, y, { width: cols.item.width });
    doc.text('QTY', cols.qty.x, y, { width: cols.qty.width, align: 'right' });
    doc.text('PRICE', cols.price.x, y, {
      width: cols.price.width,
      align: 'right',
    });
    doc.text('AMOUNT', cols.amount.x, y, {
      width: cols.amount.width,
      align: 'right',
    });

    doc.y = y + 14;
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + this.contentWidth(doc), doc.y)
      .strokeColor(colors.dark)
      .lineWidth(1.5)
      .stroke();
    doc.y += 6;
    doc.fillColor(colors.dark);
  }

  private drawLineItems(
    doc: PDFKit.PDFDocument,
    meta: DocumentMeta,
    items: PdfDocumentLineItem[],
    subtotal: string,
  ) {
    const cols = this.lineItemColumns(doc);

    this.drawLineItemsHeader(doc);

    for (const item of items) {
      const nameHeight = doc.heightOfString(item.productName, {
        width: cols.item.width,
      });
      const rowHeight = Math.max(nameHeight, 12) + 10;

      if (this.ensureSpace(doc, rowHeight + 20, meta)) {
        this.drawLineItemsHeader(doc);
      }

      const y = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor(colors.dark);
      doc.text(item.productName, cols.item.x, y, { width: cols.item.width });
      doc.text(String(item.quantity), cols.qty.x, y, {
        width: cols.qty.width,
        align: 'right',
      });
      doc.text(item.unitPrice ?? '—', cols.price.x, y, {
        width: cols.price.width,
        align: 'right',
      });
      doc.text(item.amount ?? 'TBD', cols.amount.x, y, {
        width: cols.amount.width,
        align: 'right',
      });

      doc.y = y + rowHeight;
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + this.contentWidth(doc), doc.y)
        .strokeColor(colors.border)
        .lineWidth(0.5)
        .stroke();
      doc.y += 4;
    }

    this.ensureSpace(doc, 24, meta);
    const subtotalY = doc.y;
    doc
      .moveTo(PAGE_MARGIN, subtotalY)
      .lineTo(PAGE_MARGIN + this.contentWidth(doc), subtotalY)
      .strokeColor(colors.dark)
      .lineWidth(1.5)
      .stroke();
    doc.y += 6;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.dark);
    doc.text('Subtotal', cols.item.x, doc.y, { width: cols.item.width });
    doc.text(subtotal, cols.amount.x, doc.y, {
      width: cols.amount.width,
      align: 'right',
    });
    doc.y += 22;
  }

  private drawTotals(
    doc: PDFKit.PDFDocument,
    data: QuotePdfData | InvoicePdfData,
    meta: DocumentMeta,
  ) {
    const width = this.contentWidth(doc);
    const labelX = PAGE_MARGIN + width - 230;
    const labelWidth = 150;
    const amountX = PAGE_MARGIN + width - 80;
    const amountWidth = 80;

    const row = (
      label: string,
      amount: string,
      options?: { bold?: boolean; size?: number },
    ) => {
      const font = options?.bold ? 'Helvetica-Bold' : 'Helvetica';
      const size = options?.size ?? 11;
      this.ensureSpace(doc, size + 8, meta);
      doc.font(font).fontSize(size).fillColor(colors.dark);
      const y = doc.y;
      doc.text(label, labelX, y, { width: labelWidth });
      doc.text(amount, amountX, y, { width: amountWidth, align: 'right' });
      doc.y = y + size + 8;
    };

    if (data.showTax) row(data.taxLabel, data.taxAmount);
    if (data.showDiscount) row('Discount', `-${data.discount}`);
    if (data.showShippingFee) row('Shipping', data.shippingFee);

    doc
      .moveTo(labelX, doc.y)
      .lineTo(PAGE_MARGIN + width, doc.y)
      .strokeColor(colors.dark)
      .lineWidth(1.5)
      .stroke();
    doc.y += 6;
    row('Total Due', data.total, { bold: true, size: 14 });
    doc.y += 10;
  }

  private drawNote(
    doc: PDFKit.PDFDocument,
    title: string,
    body: string,
    meta: DocumentMeta,
  ) {
    const width = this.contentWidth(doc);
    const height = doc.heightOfString(body, { width: width - 24 }) + 40;
    this.ensureSpace(doc, height + 12, meta);

    const top = doc.y;
    doc
      .rect(PAGE_MARGIN, top, width, height)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    this.writeLines(doc, PAGE_MARGIN + 12, top + 12, width - 24, [
      {
        text: title.toUpperCase(),
        font: 'Helvetica-Bold',
        size: 8,
        color: colors.muted,
        gap: 6,
      },
      { text: body, size: 10 },
    ]);

    doc.y = top + height + 14;
  }

  private drawPaymentSchedule(
    doc: PDFKit.PDFDocument,
    schedule: PdfPaymentScheduleRow[],
    meta: DocumentMeta,
  ) {
    if (!schedule.length) return;

    const width = this.contentWidth(doc);
    this.ensureSpace(doc, 40, meta);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.dark);
    doc.text('Payment Schedule', PAGE_MARGIN, doc.y);
    doc.y += 18;

    const cols = {
      name: { x: PAGE_MARGIN, width: width - 280 },
      due: { x: PAGE_MARGIN + width - 280, width: 130 },
      percentage: { x: PAGE_MARGIN + width - 150, width: 65 },
      amount: { x: PAGE_MARGIN + width - 85, width: 85 },
    };

    doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.muted);
    const headerY = doc.y;
    doc.text('ITEM', cols.name.x, headerY, { width: cols.name.width });
    doc.text('DUE', cols.due.x, headerY, { width: cols.due.width, align: 'right' });
    doc.text('PERCENTAGE', cols.percentage.x, headerY, {
      width: cols.percentage.width,
      align: 'right',
    });
    doc.text('AMOUNT', cols.amount.x, headerY, {
      width: cols.amount.width,
      align: 'right',
    });
    doc.y = headerY + 14;
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + width, doc.y)
      .strokeColor(colors.dark)
      .lineWidth(1.5)
      .stroke();
    doc.y += 6;

    for (const item of schedule) {
      this.ensureSpace(doc, 24, meta);
      const y = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor(colors.dark);
      doc.text(item.name, cols.name.x, y, { width: cols.name.width });
      doc.text(item.dueDate, cols.due.x, y, {
        width: cols.due.width,
        align: 'right',
      });
      doc.text(item.percentage, cols.percentage.x, y, {
        width: cols.percentage.width,
        align: 'right',
      });
      doc.text(item.amount, cols.amount.x, y, {
        width: cols.amount.width,
        align: 'right',
      });
      doc.y = y + 18;
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + width, doc.y)
        .strokeColor(colors.border)
        .lineWidth(0.5)
        .stroke();
      doc.y += 4;
    }
  }

  private drawInvoicePaymentSummary(
    doc: PDFKit.PDFDocument,
    data: InvoicePdfData,
    meta: DocumentMeta,
  ) {
    const width = this.contentWidth(doc);
    this.ensureSpace(doc, 60, meta);

    const colWidth = width / 2;
    const top = doc.y;

    this.writeLines(doc, PAGE_MARGIN, top, colWidth - 16, [
      {
        text: 'AMOUNT PAID',
        font: 'Helvetica-Bold',
        size: 8,
        color: colors.muted,
        gap: 6,
      },
      { text: data.amountPaid, font: 'Helvetica-Bold', size: 16 },
    ]);

    this.writeLines(doc, PAGE_MARGIN + colWidth, top, colWidth, [
      {
        text: 'BALANCE DUE',
        font: 'Helvetica-Bold',
        size: 8,
        color: colors.muted,
        align: 'right',
        gap: 6,
      },
      { text: data.balanceDue, font: 'Helvetica-Bold', size: 16, align: 'right' },
    ]);

    doc.y = top + 50;
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + width, doc.y)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();
    doc.y += 16;
  }

  private drawPaymentsLog(
    doc: PDFKit.PDFDocument,
    payments: PdfPaymentLogRow[],
    meta: DocumentMeta,
  ) {
    if (!payments.length) return;

    const width = this.contentWidth(doc);
    this.ensureSpace(doc, 40, meta);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.dark);
    doc.text('Payments', PAGE_MARGIN, doc.y);
    doc.y += 18;

    const cols = {
      date: { x: PAGE_MARGIN, width: 120 },
      method: { x: PAGE_MARGIN + 120, width: 120 },
      reference: { x: PAGE_MARGIN + 240, width: width - 240 - 85 },
      amount: { x: PAGE_MARGIN + width - 85, width: 85 },
    };

    doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.muted);
    const headerY = doc.y;
    doc.text('DATE', cols.date.x, headerY, { width: cols.date.width });
    doc.text('METHOD', cols.method.x, headerY, { width: cols.method.width });
    doc.text('REFERENCE', cols.reference.x, headerY, {
      width: cols.reference.width,
    });
    doc.text('AMOUNT', cols.amount.x, headerY, {
      width: cols.amount.width,
      align: 'right',
    });
    doc.y = headerY + 14;
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + width, doc.y)
      .strokeColor(colors.dark)
      .lineWidth(1.5)
      .stroke();
    doc.y += 6;

    for (const payment of payments) {
      this.ensureSpace(doc, 24, meta);
      const y = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor(colors.dark);
      doc.text(payment.date, cols.date.x, y, { width: cols.date.width });
      doc.text(payment.method, cols.method.x, y, { width: cols.method.width });
      doc.text(payment.reference, cols.reference.x, y, {
        width: cols.reference.width,
      });
      doc.text(payment.amount, cols.amount.x, y, {
        width: cols.amount.width,
        align: 'right',
      });
      doc.y = y + 18;
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + width, doc.y)
        .strokeColor(colors.border)
        .lineWidth(0.5)
        .stroke();
      doc.y += 4;
    }
  }
}
