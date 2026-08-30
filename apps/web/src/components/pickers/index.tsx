import { useIamRoles, useSecurityGroups, useSubnets } from "@/api/networking";
import { ResourceCombobox } from "./ResourceCombobox";

export function SubnetPicker({
  value,
  onChange,
  vpcId,
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  vpcId?: string;
  id?: string;
}) {
  const q = useSubnets(vpcId);
  return (
    <ResourceCombobox
      id={id}
      multiple
      placeholder="Select subnets"
      selected={value}
      onChange={onChange}
      loading={q.isLoading}
      unavailable={q.isError}
      options={(q.data ?? []).map((s) => ({
        value: s.subnetId,
        label: s.name ? `${s.name} (${s.subnetId})` : s.subnetId,
        hint: [s.availabilityZone, s.mapPublicIpOnLaunch ? "public" : "private"]
          .filter(Boolean)
          .join(" · "),
      }))}
    />
  );
}

export function SecurityGroupPicker({
  value,
  onChange,
  vpcId,
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  vpcId?: string;
  id?: string;
}) {
  const q = useSecurityGroups(vpcId);
  return (
    <ResourceCombobox
      id={id}
      multiple
      placeholder="Select security groups"
      selected={value}
      onChange={onChange}
      loading={q.isLoading}
      unavailable={q.isError}
      options={(q.data ?? []).map((g) => ({
        value: g.groupId,
        label: g.groupName ? `${g.groupName} (${g.groupId})` : g.groupId,
        hint: g.description,
      }))}
    />
  );
}

export function RolePicker({
  value,
  onChange,
  kind,
  id,
}: {
  value: string | undefined;
  onChange: (arn: string | undefined) => void;
  kind: "task" | "execution";
  id?: string;
}) {
  const q = useIamRoles(kind);
  return (
    <ResourceCombobox
      id={id}
      placeholder={`Select ${kind} role (optional)`}
      selected={value ? [value] : []}
      onChange={(v) => onChange(v[0])}
      loading={q.isLoading}
      unavailable={q.isError}
      options={(q.data ?? []).map((r) => ({
        value: r.arn,
        label: r.roleName,
        hint: r.kind !== "other" ? r.kind : undefined,
      }))}
    />
  );
}
