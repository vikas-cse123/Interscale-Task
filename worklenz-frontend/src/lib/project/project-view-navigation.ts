interface ProjectTab {
  key: string;
  disabled?: boolean;
}

/** Resolve a direct link only after the matching project's access payload has loaded. */
export const resolveProjectViewNavigation = (
  requestedKey: string,
  tabs: readonly ProjectTab[],
  projectReady: boolean
) => {
  if (!projectReady) return { tabKey: requestedKey, redirect: false, upgrade: false };
  const requested = tabs.find(tab => tab.key === requestedKey);
  const fallback = tabs.find(tab => !tab.disabled)?.key ?? requestedKey;
  return {
    tabKey: requested && !requested.disabled ? requested.key : fallback,
    redirect: !requested && fallback !== requestedKey,
    upgrade: Boolean(requested?.disabled),
  };
};
