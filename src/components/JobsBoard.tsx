"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { PeekButton } from "@/components/Peek";
import { PlateBadge } from "@/components/PlateBadge";
import { Icon } from "@/components/icons";
import type { JobStatus } from "@/lib/types";

type JobRow = {
  id: string;
  description: string;
  status: JobStatus;
  mechanic_name: string | null;
  created_at: string;
  vehicles: { plate_number: string; emirate: string; make: string | null; model: string | null } | null;
  customers: { name: string } | null;
};

const COLUMNS: { status: JobStatus; label: string; dot: string }[] = [
  { status: "pending", label: "Pending", dot: "bg-zinc-400" },
  { status: "in_progress", label: "In progress", dot: "bg-amber-500" },
  { status: "completed", label: "Completed", dot: "bg-emerald-500" },
];

const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
  pending: "in_progress",
  in_progress: "completed",
  completed: null,
};

const NEXT_LABEL: Record<JobStatus, string> = {
  pending: "Start job",
  in_progress: "Mark as done",
  completed: "",
};

function age(dateStr: string) {
  const hours = Math.round((Date.now() - new Date(dateStr).getTime()) / 3600000);
  if (hours < 24) return `${Math.max(hours, 0)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function JobsBoard({
  jobs,
  uninvoicedIds = [],
  updateJobStatus,
}: {
  jobs: JobRow[];
  uninvoicedIds?: string[];
  updateJobStatus: (jobId: string, status: JobStatus) => void | Promise<void>;
}) {
  const uninvoiced = new Set(uninvoicedIds);
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  // Optimistic moves: the card jumps column immediately, the server catches up.
  const [moved, setMoved] = useState<Record<string, JobStatus>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<JobStatus | null>(null);
  const statusOf = (job: JobRow) => moved[job.id] ?? job.status;

  function move(job: JobRow, to: JobStatus, withUndo = true) {
    const from = statusOf(job);
    if (from === to) return;
    setMoved((m) => ({ ...m, [job.id]: to }));
    const label = COLUMNS.find((c) => c.status === to)?.label ?? to;
    startTransition(async () => {
      try {
        await updateJobStatus(job.id, to);
        if (withUndo) {
          showToast(`${job.vehicles?.plate_number ?? "Job"} moved to ${label}`, "success", {
            action: { label: "Undo", onClick: () => move(job, from, false) },
            duration: 6000,
          });
        }
      } catch (err) {
        setMoved((m) => ({ ...m, [job.id]: from }));
        showToast(err instanceof Error ? err.message : "Could not move the job.", "error");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => statusOf(j) === col.status);
        const isOver = overCol === col.status && dragId !== null;
        return (
          <section
            key={col.status}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overCol !== col.status) setOverCol(col.status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const job = jobs.find((j) => j.id === e.dataTransfer.getData("text/job-id"));
              setOverCol(null);
              setDragId(null);
              if (job) move(job, col.status);
            }}
            className={`flex flex-col rounded-lg border transition-colors ${
              isOver ? "border-zinc-900 bg-zinc-200/60 ring-2 ring-zinc-900/10" : "border-zinc-200 bg-zinc-100/60"
            }`}
          >
            <header className="flex h-11 items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h2 className="text-[13px] font-semibold text-zinc-800">{col.label}</h2>
              </div>
              <span className="rounded-full bg-white px-2 py-px text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200 tabular">
                {colJobs.length}
              </span>
            </header>
            <div className="flex-1 space-y-2 px-2 pb-2">
              {colJobs.map((job) => {
                const status = statusOf(job);
                const next = NEXT_STATUS[status];
                return (
                  <article
                    key={job.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/job-id", job.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(job.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={`group/card rounded-md border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-zinc-300 md:cursor-grab md:active:cursor-grabbing ${
                      dragId === job.id ? "opacity-40" : ""
                    }`}
                  >
                    <Link href={`/jobs/${job.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        {job.vehicles && <PlateBadge plateNumber={job.vehicles.plate_number} emirate={job.vehicles.emirate} />}
                        <span className="flex items-center gap-1">
                          <span className="text-[11px] text-zinc-400 tabular">{age(job.created_at)}</span>
                          <span className="-mr-1.5 -mt-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100">
                            <PeekButton type="job" id={job.id} />
                          </span>
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-medium text-zinc-900">
                        {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}
                      </p>
                      <p className="truncate text-xs text-zinc-500">{job.customers?.name}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-zinc-600">{job.description}</p>
                    </Link>
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
                        <Icon name="user" className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="truncate">{job.mechanic_name ?? "Unassigned"}</span>
                      </span>
                      {next ? (
                        <button
                          type="button"
                          onClick={() => move(job, next)}
                          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                        >
                          {NEXT_LABEL[status]}
                          <Icon name="arrow-right" className="h-3 w-3" />
                        </button>
                      ) : uninvoiced.has(job.id) ? (
                        <Link
                          href={`/jobs/${job.id}`}
                          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-amber-50 px-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                        >
                          <Icon name="receipt" className="h-3 w-3" />
                          Needs invoice
                        </Link>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700">
                          <Icon name="check" className="h-3.5 w-3.5" />
                          Invoiced
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
              {colJobs.length === 0 && (
                <p className={`rounded-md border border-dashed px-3 py-6 text-center text-xs ${isOver ? "border-zinc-500 text-zinc-600" : "border-zinc-300 text-zinc-400"}`}>
                  {dragId ? `Drop here to mark ${col.label.toLowerCase()}` : "No jobs"}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
