const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;

export function pdfPageHeightPx(pageWidthPx: number): number {
  return (PDF_PAGE_HEIGHT_MM / PDF_PAGE_WIDTH_MM) * pageWidthPx;
}

/**
 * Keep avoid-break blocks from splitting across pages. Leaves top padding on
 * continuation pages and bottom padding on every page; anything that lands in
 * those padded bands is moved to the next page.
 */
export function applyPdfPageBreakAvoidance(
  container: HTMLElement,
  pageWidthPx: number,
  selector = '.invoice-print-pdf-avoid-break',
  pagePaddingPx = 0
): void {
  const pageHeightPx = pdfPageHeightPx(pageWidthPx);
  const paddedUsableHeight = Math.max(1, pageHeightPx - pagePaddingPx * 2);
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

      const pageIndex = Math.floor(top / pageHeightPx);
      const pageStart = pageIndex * pageHeightPx;
      const pageEnd = pageStart + pageHeightPx;
      const bottom = top + height;
      const pageContentTop =
        pageIndex === 0 ? pageStart : pageStart + pagePaddingPx;
      const pageContentBottom = pageEnd - pagePaddingPx;
      const canUsePagePadding = height <= paddedUsableHeight + 0.5;

      let targetTop: number | null = null;

      if (
        pageIndex > 0 &&
        canUsePagePadding &&
        top < pageContentTop - 0.5
      ) {
        // Landed in the continuation-page top margin — nudge down.
        targetTop = pageContentTop;
      } else if (top >= pageContentTop - 0.5 && bottom > pageContentBottom + 0.5) {
        // Would enter the bottom margin or split across pages — move to next page.
        targetTop = canUsePagePadding ? pageEnd + pagePaddingPx : pageEnd;
      }

      if (targetTop === null || targetTop <= top + 0.5) continue;

      const currentMargin = Number.parseFloat(getComputedStyle(element).marginTop) || 0;
      element.style.marginTop = `${currentMargin + (targetTop - top)}px`;
      adjusted = true;
    }

    if (!adjusted) break;
  }
}
