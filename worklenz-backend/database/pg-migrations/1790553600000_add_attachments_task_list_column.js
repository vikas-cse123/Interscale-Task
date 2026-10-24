exports.up = async function (pgm) {
  // ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
  // Run outside the runner's per-migration transaction (node-pg-migrate
  // wraps each migration in BEGIN/COMMIT); the value commits immediately
  // so the following seed migration can use it.
  pgm.noTransaction();
  pgm.sql(`
    ALTER TYPE WL_TASK_LIST_COL_KEY
    ADD VALUE IF NOT EXISTS 'ATTACHMENTS' AFTER 'PHASE';
  `);
};

exports.down = async function () {
  // PostgreSQL enum values cannot be removed safely after they are committed.
};
