import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { updateProfileRole, deleteProfile } from "@/app/staff/actions";
import { createStaffLogin, resetStaffPassword } from "@/app/staff/invite-actions";
import { CreateStaffLoginForm, ResetStaffPasswordForm } from "@/components/StaffLoginForms";
import { Card, PageHeader, EmptyState, SecondaryButton } from "@/components/ui";
import { RowMenu, RowMenuDelete, RowMenuOpenPanel, RowMenuSeparator } from "@/components/RowMenu";
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
            <SlideOver title="Add a staff member" description="Creates their login straight away — no Supabase needed." triggerLabel="Add staff">
              <CreateStaffLoginForm action={createStaffLogin} />
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
                  <SlideOver id={`reset-${p.id}`} hideTrigger title={`Reset password · ${p.full_name}`} triggerLabel="Reset">
                    <ResetStaffPasswordForm action={resetStaffPassword} profileId={p.id} name={p.full_name} />
                  </SlideOver>
                  <RowMenu>
                    <RowMenuOpenPanel panelId={`reset-${p.id}`} icon="shield">
                      Reset password
                    </RowMenuOpenPanel>
                    <RowMenuSeparator />
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
