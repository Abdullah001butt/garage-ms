import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { createProfile, updateProfileRole, deleteProfile } from "@/app/staff/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, labelClass, inputClass } from "@/components/ui";
import { RowMenu, RowMenuDelete } from "@/components/RowMenu";
import { SlideOver } from "@/components/SlideOver";
import { StatStrip } from "@/components/report-ui";
import { formatAed } from "@/lib/format";

export default async function StaffPage() {
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at")
    .returns<Profile[]>();

  return (
    <div className="page">
      <PageHeader
        title="Staff"
        description="Manage staff accounts, access level, and salary."
        action={
          <>
            <Link href="/staff/attendance">
              <SecondaryButton type="button" icon="calendar">Attendance & salary</SecondaryButton>
            </Link>
            <SlideOver title="Add a staff member" description="Give someone a login with the right access level." triggerLabel="Add Staff">
        <ol className="text-xs text-zinc-500 list-decimal list-inside mb-4 space-y-1">
          <li>
            Go to your{" "}
            <a
              href="https://supabase.com/dashboard/project/ypucfuidniofjhhlstaf/auth/users"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 hover:decoration-zinc-600"
            >
              Supabase Authentication → Users
            </a>{" "}
            page and click &quot;Add user&quot; with their email + a temporary password.
          </li>
          <li>Copy the new user&apos;s UID from that page.</li>
          <li>Paste it below along with their name, role, and salary.</li>
        </ol>
        <form action={createProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block col-span-full">
            <span className={labelClass}>User ID (UID from Supabase Auth)</span>
            <input type="text" name="user_id" required placeholder="00000000-0000-0000-0000-000000000000" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Full name</span>
            <input type="text" name="full_name" required className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Role</span>
            <select name="role" className={inputClass}>
              <option value="receptionist">Receptionist</option>
              <option value="mechanic">Mechanic</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <label className="block col-span-full">
            <span className={labelClass}>Monthly Salary (AED, optional)</span>
            <input type="number" name="monthly_salary" step="0.01" className={inputClass} />
          </label>
          <div className="col-span-full">
            <PrimaryButton type="submit">Add Staff Member</PrimaryButton>
          </div>
        </form>
          </SlideOver>
          </>
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load staff: {error.message}</p>}

      <StatStrip
        className="mb-6"
        items={[
          { label: "Staff accounts", value: String(profiles?.length ?? 0) },
          { label: "Mechanics", value: String((profiles ?? []).filter((p) => p.role === "mechanic").length) },
          { label: "Owners & front desk", value: String((profiles ?? []).filter((p) => p.role !== "mechanic").length) },
          {
            label: "Monthly payroll",
            value: formatAed((profiles ?? []).reduce((s, p) => s + Number(p.monthly_salary ?? 0), 0), 0),
            hint: <Link href="/staff/salaries" className="font-medium text-zinc-700 hover:underline">Open salaries →</Link>,
          },
        ]}
      />

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Access level & monthly salary (AED)</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {profiles?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
                      {p.full_name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
                    </span>
                    <span>
                      <span className="block font-medium text-zinc-900">{p.full_name}</span>
                      <span className="block text-xs capitalize text-zinc-500">{p.role}</span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <form action={updateProfileRole.bind(null, p.id)} className="flex gap-2">
                    <select name="role" defaultValue={p.role} className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm">
                      <option value="owner">Owner</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="mechanic">Mechanic</option>
                    </select>
                    <input
                      type="number"
                      name="monthly_salary"
                      placeholder="Salary AED"
                      defaultValue={p.monthly_salary ?? ""}
                      className="h-8 w-28 rounded-md border border-zinc-300 px-2 text-right text-sm tabular"
                    />
                    <button type="submit" className="h-8 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <RowMenu>
                    <RowMenuDelete action={deleteProfile.bind(null, p.id)} confirmMessage={`Remove staff member "${p.full_name}"? This cannot be undone.`} successMessage="Staff member removed." label="Remove" />
                  </RowMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {profiles?.length === 0 && <EmptyState message="No staff profiles yet." />}
      </Card>

    </div>
  );
}
