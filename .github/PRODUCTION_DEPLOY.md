# Production auto-deploy (`main` → EC2)

Workflow: `.github/workflows/deploy-production.yaml` · remote script: `.github/scripts/prod-deploy.sh`

## What it does

On every push to `main` (docs-only pushes are ignored):

1. **Detects which services changed** from the push diff:
   `worklenz-frontend/**` → frontend, `worklenz-backend/**` → backend,
   `worklenz-client-portal/**` → client portal. Anything else
   (nginx, `docker-compose.yml`, workflows, docs) deploys nothing — those always
   need a manual rollout.
2. **Gates** (a failing gate stops everything, nothing is deployed):
   - frontend — focused vitest suites + `npm run build` (includes all strict
     locale checks);
   - backend — `npm ci` + `npm run compile:prod` (same check as CI);
   - client portal — `npm ci` + `npm run build` (same check as CI).
3. **Builds Docker images in CI** for changed services only, tagged with the
   exact production tags (`worklenz-frontend:3.2.0-clientportal`,
   `worklenz-backend:3.2.0-tzfix-digestfix1`,
   `worklenz-client-portal:3.2.0-local`) plus a `main-<sha>` tag. Images are
   transferred as tarballs — **the EC2 host never compiles code** (it is too
   small for the Vite build) and no registry credentials are needed.
4. **Deploys selectively**: `docker load` + `docker compose up -d <service>`
   for changed services only. Backend, Client Portal, DB, Nginx, SeaweedFS
   are untouched by a frontend-only change (and vice versa).
5. **Verifies**: per-service container + localhost HTTP health checks on the
   host, then public `https://task.interscalemarketing.in/worklenz/` (200),
   `/portal/` (200), and `/public/health` (`{"status":"ok"}`) from the runner.
6. **Serializes** concurrent pushes (`concurrency: production-deploy`,
   `cancel-in-progress: false`) — deploys queue, never overlap.

## What it NEVER does

- No database migrations (backend boots without running any; the workflow has
  no migrate step and the remote script contains none).
- No production-data changes.
- No writes to production `.env` — the remote script checksums `.env`
  before/after and fails the run if it ever differs.
- No `docker pull / prune / system` destructive commands, no compose/nginx
  edits, no `git pull` on production (the deployed SHA is recorded in
  `~/worklenz/.ci-deploy-state`; the git checkout is left alone).

## Required manual setup (do this once, in GitHub — never commit these)

1. Repo **Settings → Environments → New environment**: name **`production`**.
   Recommended: add a **Required reviewers** rule (you) and a **Deployment
   branches** rule limited to `main`.
2. In that environment, add **Actions secrets**:
   | Secret | Value (no quotes) |
   |---|---|
   | `PROD_SSH_HOST` | `13.207.118.169` |
   | `PROD_SSH_USER` | `ubuntu` |
   | `PROD_SSH_KEY` | full content of the PEM key (`-----BEGIN ... PRIVATE KEY-----` … `-----END ...`), newlines preserved |
   | `PROD_SSH_PORT` | _(optional)_ custom SSH port; defaults to `22` when unset |
3. Keep `main` protected (require PR reviews / passing CI) so untested code
   cannot reach this workflow. Pull requests never trigger it, and fork PRs
   can never read environment secrets.

No repository files, keys, or `.env` contents are stored in this workflow —
only the secret *names* above.

## How to test safely (no production changes)

- **Dry run** (recommended first run): Actions → *Deploy to Production* →
  *Run workflow* → tick only the service(s) to validate + tick **dry_run**.
  This transfers the images, verifies tarballs/tags/compose/health
  read-only, and reports what *would* happen. The final HTTPS check step is
  skipped in dry-run mode.
- **Full validation without SSH**: the gate jobs (`test`/`compile`/`build`)
  and the image-build job run identically on any branch if you temporarily
  trigger them — but the simplest check is pushing to a scratch branch and
  confirming the workflow is *not* triggered (it only listens on `main` +
  manual dispatch).
- **Local syntax check of the remote script** (if you have Git Bash):
  `bash -n .github/scripts/prod-deploy.sh`.

## Rollback

Every deploy preserves the previous image before replacing it:

- Automatic tag: `<service-image>:ci-backup-<timestamp>` (e.g.
  `worklenz-frontend:ci-backup-20261024-120000`).
- Full image tarball + compose/nginx/`.env` copies:
  `~/prod-backups/ci/` on EC2 (compose backup) — plus the earlier manual
  backups under `~/prod-backups/frontend-20261024/`.
- Deploy provenance: `~/worklenz/.ci-deploy-state` (`sha=`, `services=`,
  `result=`).

If a deploy fails its health checks, the remote script **automatically**
re-tags the backup over the stable tag, recreates that service, re-checks,
and exits non-zero with a `ROLLED-BACK` / `ROLLBACK-FAILED` message. Manual
rollback (same procedure the script uses):

```bash
ssh -i WORKLENZ.pem ubuntu@13.207.118.169
cd ~/worklenz
docker tag worklenz-frontend:ci-backup-<TIMESTAMP> worklenz-frontend:3.2.0-clientportal
docker compose up -d frontend
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5000/   # expect 200
```

Worst case (image missing entirely): `docker load -i
~/prod-backups/frontend-20261024/frontend-3.2.0-clientportal.tar.gz`,
retag to the stable tag, `docker compose up -d frontend`.

## Troubleshooting

- **Workflow didn't trigger on push**: only `main` triggers it; docs-only
  pushes are ignored by `paths-ignore`; infra-only pushes succeed with a
  "No deployable services changed" summary (manual rollout required).
- **Gate failure**: fix the failing check on a branch, merge via PR; nothing
  was transferred or touched in production.
- **SSH failure**: verify the four environment secrets (key content must
  include BEGIN/END lines) and EC2 security-group ingress for the runner IPs.
- **Health-check failure after `up -d`**: see the job log + `docker logs
  worklenz_frontend` on EC2; the script already attempted rollback when a
  backup existed.
- **Secret/tag drift**: if production ever retags a service image, update the
  matching `*_IMAGE` value in the workflow `env:` block.
