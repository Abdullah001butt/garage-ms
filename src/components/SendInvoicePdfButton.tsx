"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useToast } from "@/components/Toast";

export function SendInvoicePdfButton({
  invoiceId,
  phone,
  customerFirstName,
  documentLabel,
}: {
  invoiceId: string;
  phone: string;
  customerFirstName: string;
  documentLabel: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast } = useToast();

  async function handleClick() {
    setIsGenerating(true);
    try {
      const node = document.getElementById("invoice-printable");
      if (!node) {
        throw new Error("Could not find invoice content to export.");
      }

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        onclone: (doc) => {
          doc.querySelectorAll('[class*="print:hidden"]').forEach((el) => {
            (el as HTMLElement).style.display = "none";
          });
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeight);

      const pdfBlob = pdf.output("blob");
      const filePath = `${invoiceId}.pdf`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("invoice-pdfs")
        .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage.from("invoice-pdfs").getPublicUrl(filePath);

      const message = `Hi ${customerFirstName}, here is your ${documentLabel.toLowerCase()} from Al Bahir Garage: ${urlData.publicUrl}`;
      window.open(buildWhatsAppLink(phone, message), "_blank", "noopener,noreferrer");
      showToast("Invoice PDF sent.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate PDF.", "error");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isGenerating}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
    >
      {isGenerating ? "Preparing PDF…" : "📄 Send PDF via WhatsApp"}
    </button>
  );
}
