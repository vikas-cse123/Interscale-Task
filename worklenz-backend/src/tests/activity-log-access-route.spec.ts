import type { RequestHandler } from "express";

jest.mock("../middlewares/verify-task-access", () => {
  const guard = jest.fn();
  return { __esModule: true, default: Object.assign(
    jest.fn((location: string, field: string) => Object.assign(guard, { location, field })),
    { guard },
  ) };
});
jest.mock("../controllers/activity-logs-controller", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("../middlewares/validators/id-param-validator", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../shared/safe-controller-function", () => ({ __esModule: true, default: (handler: RequestHandler) => handler }));

import router from "../routes/apis/activity-logs-api-router";
import verifyTaskAccess from "../middlewares/verify-task-access";
import ActivityLogsController from "../controllers/activity-logs-controller";

it("checks task access before invoking the activity log controller", () => {
  const stack = (router as unknown as { stack: Array<{ route: { path: string; stack: Array<{ handle: RequestHandler }> } }> }).stack;
  const route = stack.find(layer => layer.route.path === "/:id")?.route;
  const guard = (verifyTaskAccess as unknown as { guard: RequestHandler & { location: string; field: string } }).guard;
  expect(guard.location).toBe("params");
  expect(guard.field).toBe("id");
  expect(route?.stack[1].handle).toBe(guard);
  expect(route?.stack[2].handle).toBe(ActivityLogsController.get);
});
