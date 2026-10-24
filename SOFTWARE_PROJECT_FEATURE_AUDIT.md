# Software project feature availability

Scope: existing project implementations in the main React application, the client-facing portal,
the Express API, and deployment-level entitlement handling. No schema changes are required.

## Feature inventory

| Implemented feature | Availability for Software projects after this change | Enforcement retained |
|---|---|---|
| Backlog, issues, sprint planning and sprint lifecycle | Existing Software-specific behavior retained | Project/task permissions; completed-sprint lifecycle rules |
| Board and task/issue list | Existing behavior retained | Project membership, task visibility and mutation permissions |
| Releases, sprint/flow/cycle-time/custom reports | Existing Software-specific behavior retained | Project/task access and team scoping |
| Roadmap/Gantt | Available, including direct links | Project access, task-creation permissions and guest read-only rules |
| Project Workload | Newly exposed under More: chart, calendar, table, filters, capacity and live updates use the existing implementation | Existing project-access and guest-view middleware |
| Project Finance | Newly exposed under More: budget/currency, task costs, rate cards, calculation method and export use existing APIs | Explicit Finance permission; related task/rate-card ownership checks |
| Insights, Files, Members, Updates and Docs | Existing implementations retained; no Software-only hiding | Existing guest restrictions and explicit Docs permission |
| Software settings: details, workflow, sprints, estimation, integrations, export and deletion | Existing behavior retained | Settings, phases, export-role and delete permissions |
| Software settings: advanced progress modes, task-assignment controls and phase assignees | Shared existing Advanced Settings section now exposed; values are loaded and saved | Settings permission; unchanged backend settings checks |
| Software settings: estimates and hours per day | Shared Timeline & Estimates card replaces the reduced date-only card | Settings permission and existing date synchronization |
| Software settings: delivery confidence and note | Shared existing controls and API load/save flow now exposed | Existing project permission on the progress-tracking API |
| Software settings: custom columns | Shared existing management section now exposed | Explicit customColumns permission; field-write checks |
| Software settings: budget and currency | Shared existing section now exposed and saved through Finance APIs | Finance permission plus Settings permission to submit the settings form |
| Issue subtasks, dependencies and attachments | Removed the Software section whitelist; existing nesting rules and custom-field controls retained | Task/guest access; existing field/attachment mutation checks |
| Issue Time Log and Activity Log | Tabs and Time Log footer restored; targeted drawer-tab navigation no longer discarded | Existing read-only/guest checks; cloud product-tier gates remain |
| Built-in templates and custom template library | Available at Software project creation; selected type passes through both API adapters and backend import endpoints | Template access, creation-role and source-team checks |
| CSV import | Available for Software project creation; target project retains its selected type | Existing Owner/Admin creation requirement and import authorization |
| New Software projects with no imported phases | Shared default-sprint initializer used by blank and template creation | Inserts only when the project has no phases; imported phases are preserved |
| Health, categories, custom fields, task templates, planner tools and other tier-gated project controls | Frontend uses the backend self-hosted grant instead of stale FREE/TRIAL billing fields | Authentication, role/project permissions and backend authorization remain independent |

## Restrictions removed

- Removed `SOFTWARE_HIDDEN_VIEWS = ['finance', 'workload']` and its filter.
- Added Workload, Finance and Docs to the explicit Software tab ordering; the existing More menu exposes non-primary views.
- Direct-view resolution waits for the matching project's access payload. A stale or unloaded project cannot redirect a valid Finance/Workload link to Backlog.
- Removed Software-only template-library, template-selection and CSV exclusions. Template imports now pass `project_type` to the existing `create_project` function instead of silently creating General projects.
- Self-hosted template imports no longer apply the cloud Free-plan project-count check.
- Removed the Software issue drawer's Info-only rendering, target-tab discard and Info-only footer override.
- Removed the issue-detail whitelist that omitted subtasks, dependencies and attachments.
- Added the existing shared settings sections and their real save paths, preserving loaded values and unexposed settings.
- Frontend `canUseFeature`, `isFreeUser` and expired-trial handling honor the server-supplied self-hosted grant. Cloud billing behavior is unchanged.

## Backend and second-frontend audit

- `project-finance-api-router.ts` and `project-ratecard-api-router.ts` retain `requireFeature('finance_module')`, `requireProjectPermission('finance')`, and related-entity checks. No Software-type denial exists in their handlers.
- `/workload-gannt` retains project-access and guest-view checks on all existing read endpoints. Workload queries use the same projects, members, tasks and logs as General projects.
- Activity Log's previously ID-only route now also runs the shared `verifyTaskAccess` middleware before its controller, matching Time Log's task/tenant access policy.
- `project-access.ts`, `verify-project-access.ts`, task-visibility policies and Finance-field stripping remain unchanged.
- Both template-import endpoints preserve caller team/user ownership and custom-template access checks. Built-in/custom imports pass the selected project type to the existing SQL creation function. Existing phase inserts already default to planned sprints.
- Client Portal v2 reads are scoped by client, contact, project assignment and portal settings. No Software-only project exclusion was found; staff Finance/Workload views must not be exposed to client contacts by bypassing those controls.
- Software naming, issue fields, sprint semantics and GitHub-specific rendering are retained. These adapt the domain rather than disable an implemented General-project feature.
- The Software drawer header omits a duplicate status dropdown and Software board cards use their priority label rather than a second priority icon. Status and priority remain editable in the existing issue details; those presentation choices are retained.

## Deliberately remaining requirements

- Authentication, active team membership, tenant isolation, project access, task visibility, guest restrictions, Finance grants, Settings/custom-column grants, manager-assignment, deletion and export-role requirements remain.
- Backlog, releases and Software reports remain Software-specific to preserve General-project behavior.
- Completed-sprint restrictions and maximum subtask nesting remain valid workflow rules.
- GitHub and Slack need configured external applications, connected accounts and authorized repositories/workspaces. File storage and outgoing mail retain their external configuration requirements.
- Aggregate Projects > Workload, Projects > Roadmap, Archived, and Team Lead Export routes currently use `ComingSoonPage`. They are not complete project-view implementations and have not been replaced with invented features.

## Validation and release boundary

New regression tests cover available tabs, direct-link resolution before/after loading, Finance denial,
cloud-tier preservation, saved Software settings, Budget API calls, template project-type propagation,
custom-template tenant denial, cross-tenant project denial, task drawer navigation, restored issue
sections, and preserved sprint initialization. Existing permission and live-update suites are included.

Production is intentionally untouched. No migration, production record change, commit, push or deploy
is part of this task. Review the local diff and reported baseline check failures before authorizing release.
