import { applyPdfPageBreakAvoidance } from '@/lib/pdfPageBreaks';

const INVOICE_PADDING = 40;
const CAPTURE_SCALE = 1.5;
const JPEG_QUALITY = 0.84;

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
export const INVOICE_PDF_CAPTURE_WIDTH_PX = Math.round(PAGE_WIDTH_MM * (96 / 25.4));
export const INVOICE_PDF_PADDING_PX = INVOICE_PADDING;

type JsPdfInstance = {
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
  addPage: () => void;
  output: (type: 'blob') => Blob;
  save: (filename: string) => void;
};

function sliceCanvas(
  source: HTMLCanvasElement,
  y: number,
  height: number
): HTMLCanvasElement {
  const slice = document.createElement('canvas');
  slice.width = source.width;
  slice.height = height;
  const ctx = slice.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to prepare PDF page.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, slice.width, slice.height);
  ctx.drawImage(source, 0, y, source.width, height, 0, 0, source.width, height);
  return slice;
}

async function captureInvoicePdf(sourceSelector = '.invoice-print'): Promise<JsPdfInstance> {
  const source = document.querySelector<HTMLElement>(sourceSelector);
  if (!source) {
    throw new Error('Invoice preview is not ready. Try again in a moment.');
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.className = 'invoice-print-capture-root';
  container.style.width = `${INVOICE_PDF_CAPTURE_WIDTH_PX}px`;
  container.style.padding = `${INVOICE_PDF_PADDING_PX}px`;
  container.style.background = '#ffffff';
  container.style.boxSizing = 'border-box';

  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add('invoice-print-capture');
  clone.style.width = '100%';

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    await document.fonts.ready;
    applyPdfPageBreakAvoidance(container, INVOICE_PDF_CAPTURE_WIDTH_PX);

    const captureHeight = container.scrollHeight;

    const canvas = await html2canvas(container, {
      scale: CAPTURE_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: INVOICE_PDF_CAPTURE_WIDTH_PX,
      height: captureHeight,
      windowWidth: INVOICE_PDF_CAPTURE_WIDTH_PX,
      windowHeight: captureHeight,
      onclone: (_doc, node) => {
        const el = node as HTMLElement;
        el.style.overflow = 'visible';
        el.style.height = 'auto';
      },
    });

    const pdf = new jsPDF('p', 'mm', 'a4') as unknown as JsPdfInstance;
    const pageSliceHeightPx = Math.max(
      1,
      Math.round(canvas.width * (PAGE_HEIGHT_MM / PAGE_WIDTH_MM))
    );

    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - offsetY);
      const slice = sliceCanvas(canvas, offsetY, sliceHeightPx);
      const imgData = slice.toDataURL('image/jpeg', JPEG_QUALITY);
      const sliceHeightMm = (sliceHeightPx / canvas.width) * PAGE_WIDTH_MM;

      pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_WIDTH_MM, sliceHeightMm);

      offsetY += sliceHeightPx;
      pageIndex += 1;
    }

    return pdf;
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateInvoicePdfBlob(sourceSelector?: string): Promise<Blob> {
  const pdf = await captureInvoicePdf(sourceSelector);
  return pdf.output('blob');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to encode PDF attachment.'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to encode PDF attachment.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to encode PDF attachment.'));
    reader.readAsDataURL(blob);
  });
}

export async function generateInvoicePdfBase64(sourceSelector?: string): Promise<string> {
  const blob = await generateInvoicePdfBlob(sourceSelector);
  return blobToBase64(blob);
}

export async function downloadInvoicePdf(
  invoiceNumber: string,
  sourceSelector?: string
): Promise<void> {
  const pdf = await captureInvoicePdf(sourceSelector);
  pdf.save(`${invoiceNumber}.pdf`);
}
