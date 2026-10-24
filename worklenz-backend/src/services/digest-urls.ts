import { getBaseUrl } from "../cron_jobs/helpers";

function getPublicBaseUrl(): string {
  const configuredUrl = (process.env.BACKEND_PUBLIC_URL || "").trim();
  if (!configuredUrl) return getBaseUrl();

  return configuredUrl.replace(/\/+$/, "");
}

export const buildUnsubscribeUrl = (token: string): string => {
  return `${getPublicBaseUrl()}/public/digest/unsubscribe?token=${encodeURIComponent(token)}`;
};

export const buildManagePreferencesUrl = (): string => {
  return `${getBaseUrl()}/worklenz/settings/notifications`;
};

export const buildViewAllTasksUrl = (): string => {
  return `${getBaseUrl()}/worklenz/my-tasks`;
};
