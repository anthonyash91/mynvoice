const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;

export function pdfPageHeightPx(pageWidthPx: number): number {
  return (PDF_PAGE_HEIGHT_MM / PDF_PAGE_WIDTH_MM) * pageWidthPx;
}

export function applyPdfPageBreakAvoidance(
  container: HTMLElement,
  pageWidthPx: number,
  selector = '.invoice-print-pdf-avoid-break'
): void {
  const pageHeightPx = pdfPageHeightPx(pageWidthPx);
  const maxPasses = 32;

  for (let pass = 0; pass < maxPasses; pass++) {
    let adjusted = false;
    const containerTop = container.getBoundingClientRect().top;
    const elements = [...container.querySelectorAll<HTMLElement>(selector)];

    elements.sort((a, b) => {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });

    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const top = rect.top - containerTop;
      const height = rect.height;

      if (height <= 0 || height > pageHeightPx) continue;

      const pageStart = Math.floor(top / pageHeightPx) * pageHeightPx;
      const pageEnd = pageStart + pageHeightPx;
      const bottom = top + height;

      if (top >= pageStart && bottom > pageEnd + 0.5) {
        const currentMargin = Number.parseFloat(getComputedStyle(element).marginTop) || 0;
        const push = pageEnd - top;
        element.style.marginTop = `${currentMargin + push}px`;
        adjusted = true;
      }
    }

    if (!adjusted) break;
  }
}
