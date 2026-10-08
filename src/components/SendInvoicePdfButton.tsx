"use client";

import { Icon } from "@/components/icons";
import { withNaturalSize } from "@/components/FitToWidth";
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
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const canvas = await withNaturalSize(node, () => html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        onclone: (doc) => {
          doc.querySelectorAll('[class*="print:hidden"]').forEach((el) => {
            (el as HTMLElement).style.display = "none";
          });
        },
      }));

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      // A long invoice is shrunk to fit one A4 page (centred) instead of running off the bottom.
      const fitScale = Math.min(1, pageHeight / ((canvas.height * pageWidth) / canvas.width));
      const imgWidth = pageWidth * fitScale;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", (pageWidth - imgWidth) / 2, 0, imgWidth, imgHeight);

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
      className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 disabled:opacity-60"
    >
      <Icon name="send" className="h-4 w-4 text-zinc-500" />
      {mutation.isPending ? "Preparing PDF…" : "Send PDF via WhatsApp"}
    </button>
  );
}
