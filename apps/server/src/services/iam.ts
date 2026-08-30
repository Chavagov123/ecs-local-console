import { ListRolesCommand, type Role } from "@aws-sdk/client-iam";
import type { IamRole } from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import type { TtlCache } from "./cache.js";

const IAM_TTL = 60_000;

/** Best-effort: is this an ECS task or task-execution role? */
function classify(role: Role): IamRole["kind"] {
  const doc = decodeURIComponent(role.AssumeRolePolicyDocument ?? "");
  const trustsEcsTasks = /ecs-tasks\.amazonaws\.com/.test(doc);
  const name = (role.RoleName ?? "").toLowerCase();
  if (/execution/.test(name)) return "execution";
  if (trustsEcsTasks || /task/.test(name)) return "task";
  return "other";
}

export async function listRoles(
  clients: ClientRegistry,
  cache: TtlCache,
  kind?: "task" | "execution",
  pathPrefix?: string,
): Promise<IamRole[]> {
  return cache.wrap(
    `iam:roles:${kind ?? "*"}:${pathPrefix ?? "*"}`,
    async () => {
      const iam = clients.iam();
      const roles: Role[] = [];
      let marker: string | undefined;
      do {
        const page = await iam.send(new ListRolesCommand({ PathPrefix: pathPrefix, Marker: marker }));
        roles.push(...(page.Roles ?? []));
        marker = page.IsTruncated ? page.Marker : undefined;
      } while (marker);

      let mapped: IamRole[] = roles.map((r) => ({
        roleName: r.RoleName ?? "",
        arn: r.Arn ?? "",
        path: r.Path,
        createDate: r.CreateDate?.toISOString(),
        kind: classify(r),
      }));
      if (kind) mapped = mapped.filter((r) => r.kind === kind || r.kind === "other");
      return mapped.sort((a, b) => a.roleName.localeCompare(b.roleName));
    },
    IAM_TTL,
  );
}
