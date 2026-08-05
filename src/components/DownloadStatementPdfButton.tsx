"use client";

import { useActionMutation } from "@/hooks/useActionMutation";

export function DownloadStatementPdfButton({ customerName }: { customerName: string }) {
  const mutation = useActionMutation(
    async () => {
      const node = document.getElementById("statement-printable");
      if (!node) {
        throw new Error("Could not find statement content to export.");
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

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeight);
      pdf.save(`Statement - ${customerName}.pdf`);
    },
    { successMessage: "Statement PDF downloaded.", errorMessage: "Failed to generate PDF." }
  );

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60 print:hidden"
    >
      {mutation.isPending ? "Preparing PDF…" : "📄 Download PDF"}
    </button>
  );
}
