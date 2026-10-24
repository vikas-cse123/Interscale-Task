'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  // ALTER TYPE ... ADD VALUE cannot run inside a transaction block
  // (the duplicate_object handler below only catches an existing value,
  // not the transaction-block error). Run outside the runner's
  // per-migration transaction so the value commits immediately.
  pgm.noTransaction();
  pgm.sql(`
DO $$
BEGIN
    ALTER TYPE LANGUAGE_TYPE ADD VALUE IF NOT EXISTS 'fr';
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Enum values cannot be removed in PostgreSQL without recreating the type
};
