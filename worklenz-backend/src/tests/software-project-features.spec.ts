jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

import db from "../config/db";
import { ensureDefaultSoftwareSprint } from "../shared/software-project-defaults";
import verifyProjectAccess from "../middlewares/verify-project-access";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";
import { buildProjectAccess } from "../shared/project-access";
import { TEAM_ROLE_NAMES } from "../shared/team-permissions";

const query = db.query as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("Software project availability preserves security boundaries", () => {
  it("rejects a project in another tenant when the caller has no membership there", async () => {
    const req = createMockRequest({ user: { id: "user-a", team_id: "team-a" }, params: { id: "software-project-b" } });
    const res = createMockResponse();
    const next = jest.fn();
    query.mockResolvedValueOnce(createQueryResult([{ id: "active-member" }]))
      .mockResolvedValueOnce(createQueryResult([{ team_id: "team-b", project_type: "software" }]))
      .mockResolvedValueOnce(createQueryResult([]));
    await verifyProjectAccess("params", "id")(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("does not grant Finance merely because a user is a project manager", () => {
    const access = buildProjectAccess({ teamRole: TEAM_ROLE_NAMES.MEMBER, isGuest: false, isActive: true,
      accessLevel: "PROJECT_MANAGER", financeAccess: false, canCreateProjectsFromTemplates: false, isProjectMember: true });
    expect(access.permissions.settings).toBe(true);
    expect(access.permissions.workload).toBe(true);
    expect(access.permissions.finance).toBe(false);
    expect(access.permissions.assignPm).toBe(false);
  });

  it("preserves imported phases when initializing software templates", async () => {
    query.mockResolvedValueOnce(createQueryResult([]));
    await ensureDefaultSoftwareSprint("software-project");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE NOT EXISTS"), ["software-project", "Sprint 1", "#fbc84c"]);
    expect(query.mock.calls[0][0]).not.toMatch(/DELETE|UPDATE/);
  });
});
