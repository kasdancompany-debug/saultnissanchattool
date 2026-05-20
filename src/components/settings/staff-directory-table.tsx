import type { StaffUserRow } from "@/server/data/staff-users";
import {
  formatStaffDepartment,
  formatStaffRole,
} from "@/lib/settings/dealership-settings-v1";

import { Badge } from "@/components/ui/badge";

export function StaffDirectoryTable({ staff }: { staff: StaffUserRow[] }) {
  if (staff.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No staff accounts found.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-xs font-semibold">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="py-2 pr-4 font-medium">Department</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="border-border/80 border-b last:border-0">
              <td className="text-foreground py-3 pr-4 font-medium">
                {s.display_name}
              </td>
              <td className="text-muted-foreground py-3 pr-4 text-xs">
                {s.email}
              </td>
              <td className="py-3 pr-4">
                <Badge variant="secondary" className="font-normal">
                  {formatStaffRole(s.role)}
                </Badge>
              </td>
              <td className="text-muted-foreground py-3 pr-4">
                {formatStaffDepartment(s.department)}
              </td>
              <td className="py-3">
                {s.is_active ? (
                  <span className="text-foreground text-xs font-medium">Active</span>
                ) : (
                  <Badge variant="outline" className="text-xs font-normal">
                    Inactive
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
