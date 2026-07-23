import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { createProfile, updateProfileRole, deleteProfile } from "@/app/staff/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, labelClass, inputClass } from "@/components/ui";

export default async function StaffPage() {
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at")
    .returns<Profile[]>();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <PageHeader
        title="Staff"
        description="Manage staff accounts, access level, and salary."
        action={
          <Link href="/staff/attendance">
            <SecondaryButton type="button">Attendance & Salary</SecondaryButton>
          </Link>
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load staff: {error.message}</p>}

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role & Monthly Salary</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profiles?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{p.full_name}</td>
                <td className="px-4 py-2.5">
                  <form action={updateProfileRole.bind(null, p.id)} className="flex gap-2">
                    <select name="role" defaultValue={p.role} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                      <option value="owner">Owner</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="mechanic">Mechanic</option>
                    </select>
                    <input
                      type="number"
                      name="monthly_salary"
                      placeholder="Salary AED"
                      defaultValue={p.monthly_salary ?? ""}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <form action={deleteProfile.bind(null, p.id)}>
                    <button className="text-xs text-red-500 hover:underline">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {profiles?.length === 0 && <EmptyState message="No staff profiles yet." />}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-700 mb-2">Add a staff member</p>
        <ol className="text-xs text-slate-500 list-decimal list-inside mb-4 space-y-1">
          <li>
            Go to your{" "}
            <a
              href="https://supabase.com/dashboard/project/ypucfuidniofjhhlstaf/auth/users"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Supabase Authentication → Users
            </a>{" "}
            page and click &quot;Add user&quot; with their email + a temporary password.
          </li>
          <li>Copy the new user&apos;s UID from that page.</li>
          <li>Paste it below along with their name, role, and salary.</li>
        </ol>
        <form action={createProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block col-span-2">
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
          <label className="block col-span-2">
            <span className={labelClass}>Monthly Salary (AED, optional)</span>
            <input type="number" name="monthly_salary" step="0.01" className={inputClass} />
          </label>
          <div className="col-span-2">
            <PrimaryButton type="submit">Add Staff Member</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
