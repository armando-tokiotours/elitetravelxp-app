"use client";

/**
 * Client-side itinerary PDF — captures #itinerary-dossier-view via html2canvas + jsPDF.
 * Used for instant download and as fallback when server email/PDF fails.
 */

export async function captureItineraryPdfBlob(
  elementId = "itinerary-dossier-view"
): Promise<Blob> {
  const element =
    document.getElementById(elementId) ||
    document.getElementById("itinerary-print-view") ||
    document.querySelector(".print-document");
  if (!element) {
    throw new Error(
      "Itinerary view not found on the page. Open the Invoice / Print tab first."
    );
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: element.scrollWidth,
    // html2canvas runtime supports these; @types may lag
  } as never);

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf.output("blob");
}

export async function downloadItineraryPdf(bookingRef: string): Promise<void> {
  const blob = await captureItineraryPdfBlob();
  const safe = (bookingRef || "draft").replace(/[^\w.-]+/g, "_");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Japan_Itinerary_${safe}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function itineraryPdfToBase64(
  bookingRef?: string
): Promise<string> {
  void bookingRef;
  const blob = await captureItineraryPdfBlob();
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function printItineraryLocally(): void {
  window.print();
}
