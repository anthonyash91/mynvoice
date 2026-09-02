import { applyPdfPageBreakAvoidance } from '@/lib/pdfPageBreaks';
import invoicePrintCss from '@/styles/invoice-print.css?raw';

const INVOICE_PADDING = 40;
/** Same scale/quality for Download and every email attachment. */
const CAPTURE_SCALE = 2;
const JPEG_QUALITY = 0.92;
/** ~5 MB decoded — matches send-invoice attachment cap. */
const MAX_EMAIL_PDF_BASE64_CHARS = Math.ceil(5 * 1024 * 1024 * (4 / 3));

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
export const INVOICE_PDF_CAPTURE_WIDTH_PX = Math.round(PAGE_WIDTH_MM * (96 / 25.4));
export const INVOICE_PDF_PADDING_PX = INVOICE_PADDING;

type PdfCaptureOptions = {
  scale?: number;
  jpegQuality?: number;
};

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
  ctx.drawImage(source, 0, y, slice.width, height, 0, 0, slice.width, height);
  return slice;
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = [...root.querySelectorAll('img')];
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

async function captureInvoicePdf(
  sourceSelector = '.invoice-print',
  options: PdfCaptureOptions = {}
): Promise<JsPdfInstance> {
  const source = document.querySelector<HTMLElement>(sourceSelector);
  if (!source) {
    throw new Error('Invoice preview is not ready. Try again in a moment.');
  }

  const scale = options.scale ?? CAPTURE_SCALE;
  const jpegQuality = options.jpegQuality ?? JPEG_QUALITY;

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
  // Force layout on body — never inherit panel overflow/transform containing blocks.
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.zIndex = '-1';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';

  // Self-contained print CSS so capture never depends on stylesheet cloning.
  const style = document.createElement('style');
  style.textContent = invoicePrintCss;
  container.appendChild(style);

  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add('invoice-print-capture');
  clone.style.width = '100%';
  clone.style.background = '#ffffff';
  clone.style.color = '#111111';
  // Inline the app font stack so html2canvas cannot fall back to a browser default.
  clone.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, sans-serif';
  clone.style.fontWeight = '400';
  clone.style.setProperty('-webkit-font-smoothing', 'antialiased');
  clone.style.setProperty('-moz-osx-font-smoothing', 'grayscale');

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    await document.fonts.ready;
    await waitForImages(container);
    applyPdfPageBreakAvoidance(
      container,
      INVOICE_PDF_CAPTURE_WIDTH_PX,
      '.invoice-print-pdf-avoid-break',
      INVOICE_PDF_PADDING_PX
    );

    const captureHeight = Math.max(container.scrollHeight, clone.scrollHeight + INVOICE_PDF_PADDING_PX * 2);

    const canvas = await html2canvas(container, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: INVOICE_PDF_CAPTURE_WIDTH_PX,
      height: captureHeight,
      windowWidth: INVOICE_PDF_CAPTURE_WIDTH_PX,
      windowHeight: captureHeight,
      onclone: (doc, node) => {
        const el = node as HTMLElement;
        el.style.overflow = 'visible';
        el.style.height = 'auto';
        el.style.opacity = '1';
        el.style.left = '0';
        el.style.position = 'static';
        el.style.fontFamily =
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, sans-serif';

        const print = el.querySelector('.invoice-print') as HTMLElement | null;
        if (print) {
          print.style.fontFamily =
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, sans-serif';
        }

        // Re-inject print CSS inside the cloned document as a fallback.
        if (!doc.getElementById('invoice-print-pdf-styles')) {
          const clonedStyle = doc.createElement('style');
          clonedStyle.id = 'invoice-print-pdf-styles';
          clonedStyle.textContent = invoicePrintCss;
          doc.head.appendChild(clonedStyle);
        }
      },
    });

    if (canvas.width < 10 || canvas.height < 10) {
      throw new Error('Failed to render invoice PDF. Try again in a moment.');
    }

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
      const imgData = slice.toDataURL('image/jpeg', jpegQuality);
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

export async function generateInvoicePdfBlob(
  sourceSelector?: string,
  options?: PdfCaptureOptions
): Promise<Blob> {
  const pdf = await captureInvoicePdf(sourceSelector, options);
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

export async function generateInvoicePdfBase64(
  sourceSelector?: string,
  options?: PdfCaptureOptions
): Promise<string> {
  const blob = await generateInvoicePdfBlob(sourceSelector, options);
  return blobToBase64(blob);
}

/**
 * Same capture as Download — payment-received and other emails must match
 * the print document, not the server jsPDF layout.
 */
export async function generateEmailInvoicePdfBase64(
  sourceSelector?: string
): Promise<string> {
  const pdfBase64 = await generateInvoicePdfBase64(sourceSelector);
  if (pdfBase64.length > MAX_EMAIL_PDF_BASE64_CHARS) {
    throw new Error(
      'Invoice PDF is too large to email. Try a shorter invoice or a smaller logo.'
    );
  }
  return pdfBase64;
}

export async function downloadInvoicePdf(
  invoiceNumber: string,
  sourceSelector?: string
): Promise<void> {
  const pdf = await captureInvoicePdf(sourceSelector);
  pdf.save(`${invoiceNumber}.pdf`);
}
