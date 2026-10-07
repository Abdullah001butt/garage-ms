import Image from "next/image";

// Loading state for customer-facing pages (no staff app chrome).
export function PublicLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50" aria-busy="true" aria-label="Loading">
      <Image src="/logoalbahir.png" alt="" width={220} height={48} className="splash-logo h-10 w-auto object-contain" priority />
      <div className="mt-6 h-0.75 w-36 overflow-hidden rounded-full bg-zinc-200">
        <div className="splash-bar h-full w-2/5 rounded-full bg-brand-600" />
      </div>
    </div>
  );
}
