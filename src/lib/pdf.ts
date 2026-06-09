import { applyPdfPageBreakAvoidance } from '@/lib/pdfPageBreaks';

const INVOICE_PADDING = 40;
const CAPTURE_SCALE = 2;

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const CAPTURE_WIDTH_PX = Math.round(PAGE_WIDTH_MM * (96 / 25.4));

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
  container.style.width = `${CAPTURE_WIDTH_PX}px`;
  container.style.padding = `${INVOICE_PADDING}px`;
  container.style.background = '#ffffff';
  container.style.boxSizing = 'border-box';

  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add('invoice-print-capture');
  clone.style.width = '100%';

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    await document.fonts.ready;
    applyPdfPageBreakAvoidance(container, CAPTURE_WIDTH_PX);

    const captureHeight = container.scrollHeight;

    const canvas = await html2canvas(container, {
      scale: CAPTURE_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: CAPTURE_WIDTH_PX,
      height: captureHeight,
      windowWidth: CAPTURE_WIDTH_PX,
      windowHeight: captureHeight,
      onclone: (_doc, node) => {
        const el = node as HTMLElement;
        el.style.overflow = 'visible';
        el.style.height = 'auto';
      },
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4') as unknown as JsPdfInstance;

    const imgWidthMm = PAGE_WIDTH_MM;
    const imgHeightMm = (captureHeight / CAPTURE_WIDTH_PX) * PAGE_WIDTH_MM;

    let heightLeft = imgHeightMm;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm);
    heightLeft -= PAGE_HEIGHT_MM;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidthMm, imgHeightMm);
      heightLeft -= PAGE_HEIGHT_MM;
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
