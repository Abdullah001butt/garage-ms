export function PlateBadge({
  plateNumber,
  emirate,
  className = "",
}: {
  plateNumber: string;
  emirate?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-sm ${className}`}
    >
      <span className="flex flex-col items-center justify-center bg-blue-700 px-1.5 py-0.5 text-[8px] font-bold leading-tight text-white">
        <span>UAE</span>
      </span>
      <span className="flex flex-col justify-center px-2 py-0.5">
        {emirate && (
          <span className="text-center text-[8px] font-semibold uppercase tracking-wide text-blue-700">
            {emirate}
          </span>
        )}
        <span className="text-center font-mono text-sm font-extrabold tracking-widest text-slate-900">
          {plateNumber}
        </span>
      </span>
    </span>
  );
}
