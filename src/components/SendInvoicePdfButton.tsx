"use client";

import { createClient } from "@/lib/supabase/client";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useActionMutation } from "@/hooks/useActionMutation";

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
  const mutation = useActionMutation(
    async () => {
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
    },
    { successMessage: "Invoice PDF sent.", errorMessage: "Failed to generate PDF." }
  );

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
    >
      {mutation.isPending ? "Preparing PDF…" : "📄 Send PDF via WhatsApp"}
    </button>
  );
}
