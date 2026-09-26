"use client";

/**
 * Client-side itinerary PDF via html2pdf.js —
 * targets invoice and/or dossier DOM (never the Send PDF modal).
 */

export type PdfCaptureTarget = "invoice" | "dossier";

const INVOICE_ID = "itinerary-invoice-content";

function resolveInvoiceElement(): HTMLElement | null {
  return (
    document.getElementById(INVOICE_ID) ||
    (document.querySelector(".print-document") as HTMLElement | null)
  );
}

function resolveDossierElement(): HTMLElement | null {
  return (
    document.getElementById("itinerary-dossier-view") ||
    document.getElementById("single-day-dossier-view") ||
    document.getElementById("itinerary-print-view")
  );
}

function resolveCaptureElement(target: PdfCaptureTarget): HTMLElement | null {
  if (target === "dossier") {
    return resolveDossierElement() || resolveInvoiceElement();
  }
  return resolveInvoiceElement() || resolveDossierElement();
}

/** Temporarily bring off-screen invoice into layout for capture. */
function prepareOffscreenCapture(element: HTMLElement): () => void {
  const wrappers: HTMLElement[] = [];
  let node: HTMLElement | null = element;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const left = parseFloat(style.left);
    if (style.position === "fixed" || style.position === "absolute") {
      if (
        (Number.isFinite(left) && left < -500) ||
        node.classList.contains("invoice-capture-offscreen")
      ) {
        wrappers.push(node);
      }
    }
    node = node.parentElement;
  }

  const snapshots = wrappers.map((el) => ({
    el,
    cssText: el.style.cssText,
  }));

  for (const el of wrappers) {
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.opacity = "1";
    el.style.visibility = "visible";
    el.style.pointerEvents = "none";
    el.style.zIndex = "-1";
    el.style.position = "fixed";
  }

  return () => {
    for (const { el, cssText } of snapshots) {
      el.style.cssText = cssText;
    }
  };
}

function pdfFilename(bookingRef: string, target?: PdfCaptureTarget): string {
  const safe = (bookingRef || "draft").replace(/[^\w.-]+/g, "_");
  if (target === "dossier") return `Japan_Travel_Dossier_${safe}.pdf`;
  if (target === "invoice") return `Japan_Invoice_${safe}.pdf`;
  return `Japan_Itinerary_${safe}.pdf`;
}

function html2pdfOptions(bookingRef: string, target?: PdfCaptureTarget) {
  return {
    margin: 10,
    filename: pdfFilename(bookingRef, target),
    image: { type: "jpeg" as const, quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    },
    jsPDF: {
      unit: "mm" as const,
      format: "a4" as const,
      orientation: "portrait" as const,
    },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] as string[] },
  };
}

async function loadHtml2Pdf(): Promise<
  (el?: HTMLElement) => {
    set: (opts: unknown) => {
      from: (src: HTMLElement) => {
        save: () => Promise<void>;
        outputPdf: (type: string) => Promise<Blob | string>;
      };
    };
  }
> {
  const mod = await import("html2pdf.js");
  return (mod.default || mod) as never;
}

export async function captureItineraryPdfBlob(
  bookingRef = "draft",
  target: PdfCaptureTarget = "invoice"
): Promise<Blob> {
  document.body.classList.add("print-capturing");
  let restoreOffscreen: (() => void) | null = null;

  try {
    const element = resolveCaptureElement(target);
    if (!element) {
      throw new Error(
        target === "dossier"
          ? "Travel dossier not found. Open Travel Dossier first."
          : "Itemized invoice not found (#itinerary-invoice-content). Open Invoice / Print first."
      );
    }

    restoreOffscreen = prepareOffscreenCapture(element);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    await new Promise((r) => setTimeout(r, 50));

    const html2pdf = await loadHtml2Pdf();
    const blob = (await html2pdf()
      .set(html2pdfOptions(bookingRef, target))
      .from(element)
      .outputPdf("blob")) as Blob;

    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error("html2pdf produced an empty PDF.");
    }
    return blob;
  } finally {
    restoreOffscreen?.();
    document.body.classList.remove("print-capturing");
  }
}

export async function downloadItineraryPdf(
  bookingRef: string,
  target: PdfCaptureTarget = "invoice"
): Promise<void> {
  document.body.classList.add("print-capturing");
  let restoreOffscreen: (() => void) | null = null;

  try {
    const element = resolveCaptureElement(target);
    if (!element) {
      throw new Error(
        target === "dossier"
          ? "Travel dossier not found. Open Travel Dossier first."
          : "Itemized invoice not found (#itinerary-invoice-content). Open Invoice / Print first."
      );
    }

    restoreOffscreen = prepareOffscreenCapture(element);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    await new Promise((r) => setTimeout(r, 50));

    const html2pdf = await loadHtml2Pdf();
    await html2pdf()
      .set(html2pdfOptions(bookingRef, target))
      .from(element)
      .save();
  } finally {
    restoreOffscreen?.();
    document.body.classList.remove("print-capturing");
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function itineraryPdfToBase64(
  bookingRef?: string,
  target: PdfCaptureTarget = "invoice"
): Promise<string> {
  const blob = await captureItineraryPdfBlob(bookingRef || "draft", target);
  return blobToBase64(blob);
}

export type SendDocSelection = {
  dossier: boolean;
  invoice: boolean;
};

/** Capture selected docs as base64 PDFs for email attachment. */
export async function captureSelectedPdfsBase64(
  bookingRef: string,
  selection: SendDocSelection
): Promise<Array<{ kind: PdfCaptureTarget; base64: string; filename: string }>> {
  const out: Array<{
    kind: PdfCaptureTarget;
    base64: string;
    filename: string;
  }> = [];
  const ref = bookingRef || "draft";

  if (selection.dossier) {
    const base64 = await itineraryPdfToBase64(ref, "dossier");
    out.push({
      kind: "dossier",
      base64,
      filename: pdfFilename(ref, "dossier"),
    });
  }
  if (selection.invoice) {
    const base64 = await itineraryPdfToBase64(ref, "invoice");
    out.push({
      kind: "invoice",
      base64,
      filename: pdfFilename(ref, "invoice"),
    });
  }
  return out;
}

/** Local save — prefers html2pdf.js; falls back to print isolation CSS. */
export async function printItineraryLocally(
  bookingRef = "draft",
  target: PdfCaptureTarget = "invoice"
): Promise<void> {
  try {
    await downloadItineraryPdf(bookingRef, target);
  } catch {
    document.body.classList.add("print-capturing");
    const cleanup = () => {
      document.body.classList.remove("print-capturing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(cleanup, 3000);
    window.print();
  }
}
