"use client";

import { Icon } from "@/components/icons";
import { withNaturalSize } from "@/components/FitToWidth";
import { createClient } from "@/lib/supabase/client";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useActionMutation } from "@/hooks/useActionMutation";

export function SendEvaluationPdfButton({
  evaluationId,
  refNumber,
  phone,
  customerFirstName,
}: {
  evaluationId: string;
  refNumber: string;
  phone: string;
  customerFirstName: string;
}) {
  const mutation = useActionMutation(
    async () => {
      const node = document.getElementById("evaluation-printable");
      if (!node) {
        throw new Error("Could not find report content to export.");
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

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeight);

      const pdfBlob = pdf.output("blob");
      const filePath = `${evaluationId}.pdf`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("evaluation-pdfs")
        .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage.from("evaluation-pdfs").getPublicUrl(filePath);

      const message = `Hi ${customerFirstName}, here is your vehicle evaluation report (${refNumber}) from Al Bahir Garage: ${urlData.publicUrl}`;
      window.open(buildWhatsAppLink(phone, message), "_blank", "noopener,noreferrer");
    },
    { successMessage: "Evaluation PDF sent.", errorMessage: "Failed to generate PDF." }
  );

  if (!phone) return null;

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 disabled:opacity-60 print:hidden"
    >
      <Icon name="send" className="h-4 w-4 text-zinc-500" />
      {mutation.isPending ? "Preparing PDF…" : "Send via WhatsApp"}
    </button>
  );
}
