const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.join(__dirname, 'prod-deploy.sh');

function runDeployment(failHealth = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worklenz-deploy-test-'));
  const bin = path.join(root, 'bin');
  const incoming = path.join(root, 'incoming');
  fs.mkdirSync(bin);
  fs.mkdirSync(incoming);
  fs.writeFileSync(path.join(root, 'docker-compose.yml'), 'services: {}\n');
  fs.writeFileSync(path.join(root, '.env'), 'TEST_VALUE=preserve\n');
  fs.writeFileSync(path.join(incoming, 'frontend.tar.gz'), 'mock image');
  fs.writeFileSync(path.join(incoming, 'backend.tar.gz'), 'mock image');
  const log = path.join(root, 'calls');
  const restored = path.join(root, 'restored');
  const docker = [
    '#!/bin/bash', 'set -eu', 'echo "$*" >> "$TEST_LOG"',
    'if [ "$1" = inspect ]; then',
    '  if [[ "$3" == *State.Status* && "$3" != *State.Restarting* ]]; then echo "invalid Docker state template" >&2; exit 1; fi',
    '  if [[ "$3" == *State.Status* ]]; then echo "running false"; else echo "sha256:old-$4"; fi',
    'elif [ "$1" = tag ] && [[ "$2" == *ci-backup* ]]; then touch "$TEST_RESTORED"',
    'elif [ "$1" = image ] && [ "$2" = inspect ] && [[ "$*" == *--format* ]]; then echo "sha256:new"',
    'fi', '',
  ].join('\n');
  const curl = [
    '#!/bin/bash',
    'if [ "$TEST_FAIL_HEALTH" = true ] && [ ! -e "$TEST_RESTORED" ]; then echo 500',
    'elif [[ "$*" == *3000* ]]; then echo \'{"status":"ok"}\'',
    'else echo 200', 'fi', '',
  ].join('\n');
  for (const [name, body] of Object.entries({ docker, curl, sleep: '#!/bin/bash\nexit 0\n' })) {
    fs.writeFileSync(path.join(bin, name), body, { mode: 0o755 });
  }
  const result = spawnSync('bash', [script, '--dir', root, '--incoming', incoming,
    '--services', 'frontend backend', '--sha', 'test-sha',
    '--frontend-image', 'worklenz-frontend:stable',
    '--backend-image', 'worklenz-backend:stable'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: root, PATH: bin + ':' + process.env.PATH,
      TEST_LOG: log, TEST_RESTORED: restored, TEST_FAIL_HEALTH: String(failHealth) },
  });
  const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
  return { root, result, calls };
}

test('preserves running images before loading and recreates only requested services', () => {
  const { root, result, calls } = runDeployment();
  try {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(calls.some(line => line.includes("{{.State.Status}} {{.State.Restarting}}")));
    const load = calls.findIndex(line => line.startsWith('load '));
    for (const service of ['frontend', 'backend']) {
      const snapshot = calls.findIndex(line => line.startsWith('tag sha256:old-worklenz_' + service + ' '));
      assert.ok(snapshot >= 0 && snapshot < load, calls.join('\n'));
    }
    assert.deepEqual(calls.filter(line => line.startsWith('compose up')),
      ['compose up -d --no-deps frontend', 'compose up -d --no-deps backend']);
    assert.ok(!calls.some(line => /prune|down|migrate|client-portal/.test(line)));
    assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), 'TEST_VALUE=preserve\n');
    assert.match(fs.readFileSync(path.join(root, '.ci-deploy-state'), 'utf8'), /result=SUCCESS/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('failed readiness restores the pre-load image and reports failure', () => {
  const { root, result, calls } = runDeployment(true);
  try {
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const restore = calls.find(line => /^tag worklenz-frontend:ci-backup-/.test(line));
    assert.ok(restore?.endsWith(' worklenz-frontend:stable'));
    assert.match(result.stdout, /ROLLED-BACK: frontend restored/);
    assert.match(fs.readFileSync(path.join(root, '.ci-deploy-state'), 'utf8'), /result=FAILURE:.*rolled-back/);
    assert.ok(!calls.some(line => /migrate|prune|compose down/.test(line)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('image gate accepts skipped unchanged services but rejects failures and cancellation', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../workflows/deploy-production.yaml'), 'utf8');
  const expression = workflow.match(/  build-images:[\s\S]*?    if: >-\r?\n([\s\S]*?)    runs-on:/)[1]
    .replace(/always\(\)/g, 'true').replace(/cancelled\(\)/g, 'cancelled')
    .replace(/needs\.([a-z-]+)\.result/g, (_, job) => 'results[' + JSON.stringify(job) + ']')
    .replace(/needs\.changes\.outputs\.([a-z_]+)/g, (_, key) => 'outputs[' + JSON.stringify(key) + ']');
  const evaluate = new Function('results', 'outputs', 'cancelled', 'return (' + expression + ');');
  const results = { changes: 'success', 'gate-frontend': 'success', 'gate-backend': 'success',
    'gate-client-portal': 'skipped' };
  const outputs = { frontend: 'true', backend: 'true', client_portal: 'false' };
  assert.equal(evaluate(results, outputs, false), true);
  assert.equal(evaluate({ ...results, 'gate-backend': 'failure' }, outputs, false), false);
  assert.equal(evaluate({ ...results, 'gate-frontend': 'cancelled' }, outputs, false), false);
  assert.equal(evaluate(results, outputs, true), false);
  assert.equal(evaluate(results, { frontend: 'false', backend: 'false', client_portal: 'false' }, false), false);
  assert.match(workflow, /AVAILABLE_BYTES.*-ge.*REQUIRED_BYTES/);
  assert.match(workflow, /prod-deploy-incoming\/\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
});

test('deployment runs after successful builds despite a skipped transitive service gate', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../workflows/deploy-production.yaml'), 'utf8');
  const condition = workflow.match(/  deploy:[\s\S]*?    if: >-\r?\n([\s\S]*?)    runs-on:/)[1];
  assert.match(condition, /always\(\)/);
  const expression = condition.replace(/always\(\)/g, 'true')
    .replace(/cancelled\(\)/g, 'cancelled')
    .replace(/needs\.([a-z-]+)\.result/g, (_, job) => 'results[' + JSON.stringify(job) + ']')
    .replace(/needs\.changes\.outputs\.([a-z_]+)/g, (_, key) => 'outputs[' + JSON.stringify(key) + ']');
  const evaluate = new Function('results', 'outputs', 'cancelled', 'return (' + expression + ');');
  const results = { changes: 'success', 'build-images': 'success' };
  const outputs = { frontend: 'true', backend: 'true', client_portal: 'false' };
  assert.equal(evaluate(results, outputs, false), true);
  assert.equal(evaluate({ ...results, 'build-images': 'failure' }, outputs, false), false);
  assert.equal(evaluate({ ...results, 'build-images': 'skipped' }, outputs, false), false);
  assert.equal(evaluate(results, outputs, true), false);
});
