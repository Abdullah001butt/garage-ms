export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-5 w-40 rounded bg-slate-200 mb-2" />
          <div className="h-3 w-64 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="h-3 w-20 rounded bg-slate-100 mb-3" />
            <div className="h-6 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 last:border-0">
            <div className="space-y-2">
              <div className="h-3.5 w-40 rounded bg-slate-200" />
              <div className="h-3 w-24 rounded bg-slate-100" />
            </div>
            <div className="h-5 w-16 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
