// Loading placeholders shaped like the real pages, so navigation shows the
// page's outline instantly instead of a blank flash.

function Bone({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

function HeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="space-y-2.5">
        <Bone className="h-6 w-44" />
        <Bone className="h-3.5 w-72 max-w-[60vw]" />
      </div>
      <div className="hidden gap-2 sm:flex">
        {Array.from({ length: actions }).map((_, i) => (
          <Bone key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-lg border border-zinc-200 bg-white ${className}`}>{children}</div>;
}

function TableRows({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      <div className="flex items-center gap-6 border-b border-zinc-200 bg-zinc-50/80 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className={`h-3 ${i === 0 ? "w-32" : "w-20"} ${i === cols - 1 ? "ml-auto" : ""}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-zinc-100 px-4 py-3.5 last:border-0">
          <div className="flex items-center gap-3">
            <Bone className="h-8 w-8 rounded-md" />
            <div className="space-y-2">
              <Bone className="h-3.5 w-40" />
              <Bone className="h-3 w-24" />
            </div>
          </div>
          {Array.from({ length: cols - 2 }).map((_, i) => (
            <Bone key={i} className="hidden h-3.5 w-24 md:block" />
          ))}
          <Bone className="ml-auto h-3.5 w-20" />
        </div>
      ))}
    </>
  );
}

/** List/table pages: header, filter toolbar, rows. */
export function TableSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton actions={2} />
      <CardShell>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-3">
          <Bone className="h-8 w-56 rounded-md" />
          <Bone className="hidden h-8 w-64 rounded-md sm:block" />
        </div>
        <TableRows />
      </CardShell>
    </div>
  );
}

/** Today / Dashboard: KPI tiles then panels. */
export function DashboardSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton actions={3} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardShell key={i} className="p-4">
            <Bone className="h-3 w-24" />
            <Bone className="mt-3 h-7 w-28" />
            <Bone className="mt-3 h-3 w-32" />
          </CardShell>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <CardShell className="lg:col-span-3">
          <div className="border-b border-zinc-200 px-4 py-3.5">
            <Bone className="h-3.5 w-28" />
          </div>
          <TableRows rows={4} cols={3} />
        </CardShell>
        <CardShell className="lg:col-span-2">
          <div className="border-b border-zinc-200 px-4 py-3.5">
            <Bone className="h-3.5 w-36" />
          </div>
          <div className="space-y-4 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Bone className="h-4 w-14" />
                <div className="space-y-2">
                  <Bone className="h-3.5 w-32" />
                  <Bone className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardShell>
      </div>
    </div>
  );
}

/** Job Cards board: three columns of cards. */
export function BoardSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="mb-4 flex justify-between">
        <Bone className="h-8 w-72 rounded-md" />
        <Bone className="h-8 w-28 rounded-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, c) => (
          <div key={c} className="rounded-lg border border-zinc-200 bg-zinc-100/60 p-2">
            <Bone className="mx-1 my-2.5 h-3.5 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 3 - (c % 2) }).map((_, i) => (
                <div key={i} className="rounded-md border border-zinc-200 bg-white p-3">
                  <Bone className="h-7 w-28 rounded-md" />
                  <Bone className="mt-3 h-3.5 w-36" />
                  <Bone className="mt-2 h-3 w-24" />
                  <Bone className="mt-3 h-3 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Detail pages: title block, info card, sections. */
export function DetailSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <Bone className="mb-4 h-3.5 w-28" />
      <HeaderSkeleton actions={2} />
      <div className="mb-6 flex gap-1 border-b border-zinc-200 pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="mr-4 h-3.5 w-16" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardShell className="p-5">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Bone className="h-3 w-16" />
                  <Bone className="h-4 w-24" />
                </div>
              ))}
            </div>
          </CardShell>
          <CardShell>
            <TableRows rows={4} cols={3} />
          </CardShell>
        </div>
        <CardShell className="p-5">
          <Bone className="h-3.5 w-28" />
          <Bone className="mt-4 h-8 w-36" />
          <Bone className="mt-4 h-3 w-full" />
          <Bone className="mt-2 h-3 w-4/5" />
        </CardShell>
      </div>
    </div>
  );
}
