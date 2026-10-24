jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/io", () => ({ IO: { getSocketById: jest.fn() } }));
jest.mock("../controllers/onboarding-controller", () => ({ __esModule: true, default: {} }));
jest.mock("../shared/software-project-defaults", () => ({ ensureDefaultSoftwareSprint: jest.fn() }));
jest.mock("../shared/paddle-utils", () => ({ getCurrentProjectsCount: jest.fn(), getFreePlanSettings: jest.fn() }));

import ProjectTemplatesController from "../controllers/project-templates/pt-templates-controller";
import { ensureDefaultSoftwareSprint } from "../shared/software-project-defaults";
import { getFreePlanSettings } from "../shared/paddle-utils";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

const originalMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
const methods = ProjectTemplatesController as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;

beforeEach(() => {
  process.env.WORKLENZ_DEPLOYMENT_MODE = "self_hosted";
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  if (originalMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
  else process.env.WORKLENZ_DEPLOYMENT_MODE = originalMode;
});

describe("Software template import endpoints", () => {
  it.each(["software", "general"])("passes %s through the existing project-creation chain", async projectType => {
    jest.spyOn(methods, "getTemplateData").mockResolvedValue({ name: "Template", tasks: [], phases: [], labels: [], phase_label: "Phase" });
    jest.spyOn(methods, "findDuplicateProjectName").mockResolvedValue(false);
    jest.spyOn(methods, "getDefaultProjectStatus").mockResolvedValue("status");
    jest.spyOn(methods, "getDefaultProjectHealth").mockResolvedValue("health");
    const create = jest.spyOn(methods, "importTemplate").mockResolvedValue("new-project");
    for (const method of ["insertTeamLabels", "insertProjectPhases", "insertProjectTasks", "applyTemplateProjectManagers", "logProjectCreatedFromTemplate"]) {
      jest.spyOn(methods, method).mockResolvedValue(undefined);
    }
    const req = createMockRequest({ user: { id: "owner", team_id: "team-a", owner_id: "owner", subscription_status: "free" },
      body: { template_id: "template", project_type: projectType } });
    const res = createMockResponse();
    await ProjectTemplatesController.importTemplates(req, res);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ project_type: projectType, team_id: "team-a", user_id: "owner" }));
    expect(res.body.done).toBe(true);
    expect(getFreePlanSettings).not.toHaveBeenCalled();
    expect(ensureDefaultSoftwareSprint).toHaveBeenCalledTimes(projectType === "software" ? 1 : 0);
  });

  it("does not allow custom template access across teams", async () => {
    const access = jest.spyOn(methods, "getCustomTemplateAccess").mockResolvedValue({ canAccess: false });
    const create = jest.spyOn(methods, "importTemplate").mockResolvedValue("must-not-create");
    const req = createMockRequest({ user: { id: "owner-a", team_id: "team-a" },
      body: { template_id: "team-b-template", project_type: "software" } });
    const res = createMockResponse();
    await ProjectTemplatesController.importCustomTemplate(req, res);
    expect(access).toHaveBeenCalledWith("team-b-template", "team-a");
    expect(res.statusCode).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });
});
