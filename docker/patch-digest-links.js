const fs = require("fs");

function replaceOnce(file, before, after) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected compiled block not found in ${file}`);
  }
  fs.writeFileSync(file, source.replace(before, after));
  console.log(`patched=${file}`);
}

const authFile = "/app/build/ee/controllers/client-portal/client-portal-auth-controller.js";
replaceOnce(
  authFile,
  'const portalLink = `${process.env.CLIENT_PORTAL_HOSTNAME\n                ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`\n                : "http://localhost:5174"}/organization-invite?token=${encodeURIComponent(inviteToken)}`;',
  'const portalLink = `${helpers_1.getClientPortalBaseUrl() || "http://localhost:5174"}/organization-invite?token=${encodeURIComponent(inviteToken)}`;'
);

const teamFile = "/app/build/ee/controllers/client-portal/client-portal-team-controller.js";
replaceOnce(
  teamFile,
  'const token_service_1 = tslib_1.__importDefault(require("../../../services/token-service"));',
  'const token_service_1 = tslib_1.__importDefault(require("../../../services/token-service"));\nconst cron_helpers_1 = require("../../../cron_jobs/helpers");'
);
replaceOnce(
  teamFile,
  'const inviteLink = `${process.env.CLIENT_PORTAL_HOSTNAME ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}` : "http://localhost:5174"}/invitation?token=${inviteToken}`;',
  'const inviteLink = `${cron_helpers_1.getClientPortalBaseUrl() || "http://localhost:5174"}/invitation?token=${inviteToken}`;'
);
replaceOnce(
  teamFile,
  'const inviteLink = `${process.env.CLIENT_PORTAL_HOSTNAME\n                ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`\n                : "http://localhost:5174"}/invitation?token=${encodeURIComponent(newToken)}`;',
  'const inviteLink = `${cron_helpers_1.getClientPortalBaseUrl() || "http://localhost:5174"}/invitation?token=${encodeURIComponent(newToken)}`;'
);

const templatesFile = "/app/build/shared/email-templates.js";
replaceOnce(
  templatesFile,
  'const db_1 = tslib_1.__importDefault(require("../config/db"));',
  'const db_1 = tslib_1.__importDefault(require("../config/db"));\nconst cron_helpers_1 = require("../cron_jobs/helpers");'
);
replaceOnce(
  templatesFile,
  'const CLIENT_PORTAL_HOSTNAME = process.env.CLIENT_PORTAL_HOSTNAME\n        ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`\n        : "http://localhost:5174";',
  'const CLIENT_PORTAL_BASE_URL = cron_helpers_1.getClientPortalBaseUrl() || "http://localhost:5174";'
);
const templatesSource = fs.readFileSync(templatesFile, "utf8");
fs.writeFileSync(templatesFile, templatesSource.replaceAll("CLIENT_PORTAL_HOSTNAME", "CLIENT_PORTAL_BASE_URL"));
console.log(`patched=${templatesFile}`);
