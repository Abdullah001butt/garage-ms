"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import { PlateBadge } from "@/components/PlateBadge";
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

const COLUMNS: { status: JobStatus; label: string; color: "gray" | "amber" | "green" }[] = [
  { status: "pending", label: "Pending", color: "gray" },
  { status: "in_progress", label: "In Progress", color: "amber" },
  { status: "completed", label: "Completed", color: "green" },
];

const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
  pending: "in_progress",
  in_progress: "completed",
  completed: null,
};

const NEXT_LABEL: Record<JobStatus, string> = {
  pending: "Start Job →",
  in_progress: "Mark Done →",
  completed: "",
};

export function JobsBoard({
  jobs,
  updateJobStatus,
}: {
  jobs: JobRow[];
  updateJobStatus: (jobId: string, status: JobStatus) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => j.status === col.status);
        return (
          <div key={col.status} className="rounded-xl bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">{col.label}</p>
              <Badge color={col.color}>{colJobs.length}</Badge>
            </div>
            <div className="space-y-2">
              {colJobs.map((job) => {
                const next = NEXT_STATUS[job.status];
                return (
                  <div key={job.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <Link href={`/jobs/${job.id}`} className="block">
                      <div className="mb-1">
                        {job.vehicles && (
                          <PlateBadge plateNumber={job.vehicles.plate_number} emirate={job.vehicles.emirate} />
                        )}
                      </div>
                      {(job.vehicles?.make || job.vehicles?.model) && (
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ")}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 truncate">{job.customers?.name}</p>
                      <p className="text-xs text-slate-400 truncate">{job.description}</p>
                      {job.mechanic_name && (
                        <p className="mt-1 text-xs text-indigo-600">👤 {job.mechanic_name}</p>
                      )}
                    </Link>
                    {next && (
                      <button
                        type="button"
                        onClick={() => updateJobStatus(job.id, next)}
                        className="mt-2 w-full rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        {NEXT_LABEL[job.status]}
                      </button>
                    )}
                  </div>
                );
              })}
              {colJobs.length === 0 && (
                <p className="px-1 py-2 text-xs text-slate-400">Nothing here.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
