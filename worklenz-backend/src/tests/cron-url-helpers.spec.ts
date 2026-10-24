const mockIsLocalServer = jest.fn();

jest.mock("../shared/utils", () => ({
  isLocalServer: () => mockIsLocalServer(),
}));

import { getBaseUrl, getClientPortalBaseUrl } from "../cron_jobs/helpers";

const originalFrontendUrl = process.env.FRONTEND_URL;
const originalClientPortalHostname = process.env.CLIENT_PORTAL_HOSTNAME;

describe("cron URL helpers", () => {
  beforeEach(() => {
    mockIsLocalServer.mockReturnValue(false);
    delete process.env.FRONTEND_URL;
    delete process.env.CLIENT_PORTAL_HOSTNAME;
  });

  afterAll(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }

    if (originalClientPortalHostname === undefined) {
      delete process.env.CLIENT_PORTAL_HOSTNAME;
    } else {
      process.env.CLIENT_PORTAL_HOSTNAME = originalClientPortalHostname;
    }
  });

  it("preserves an absolute frontend URL without double-prefixing the scheme", () => {
    process.env.FRONTEND_URL = "https://app.example.com/";

    expect(getBaseUrl()).toBe("https://app.example.com");
  });

  it("adds https to a production frontend hostname", () => {
    process.env.FRONTEND_URL = "app.example.com";

    expect(getBaseUrl()).toBe("https://app.example.com");
  });

  it("uses http for a local frontend hostname", () => {
    mockIsLocalServer.mockReturnValue(true);
    process.env.FRONTEND_URL = "localhost:5000";

    expect(getBaseUrl()).toBe("http://localhost:5000");
  });

  it("preserves an explicitly configured local scheme", () => {
    process.env.FRONTEND_URL = "http://localhost:5000";

    expect(getBaseUrl()).toBe("http://localhost:5000");
  });

  it("preserves an absolute client portal URL without double-prefixing the scheme", () => {
    process.env.CLIENT_PORTAL_HOSTNAME = "https://client.example.com/";

    expect(getClientPortalBaseUrl()).toBe("https://client.example.com");
  });

  it("adds https to a production client portal hostname", () => {
    process.env.CLIENT_PORTAL_HOSTNAME = "client.example.com";

    expect(getClientPortalBaseUrl()).toBe("https://client.example.com");
  });

  it("uses http for a local client portal hostname", () => {
    process.env.CLIENT_PORTAL_HOSTNAME = "localhost:5174";

    expect(getClientPortalBaseUrl()).toBe("http://localhost:5174");
  });

  it("returns an empty base URL when configuration is missing", () => {
    expect(getBaseUrl()).toBe("");
    expect(getClientPortalBaseUrl()).toBe("");
  });
});
