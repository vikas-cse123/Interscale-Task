'use strict';
// Client Portal v2, client-facing app (#2520): per-person state that the staff-only tables could
// not hold.
//
//   client_portal_thread_client_reads   a client user's own "read up to here" mark per discussion
//                                        thread, so the sidebar badge and the unread dot are per person.
//                                        (client_portal_thread_reads is the staff side, keyed by user.)
//   client_portal_notification_reads    a client user's own read state per notification. A client
//                                        notification row is created once per organization event; who it
//                                        reaches is decided at read time (project access, named approver),
//                                        so "read" has to be stored per person too.
//   client_contact_notification_prefs   which events a client user wants emailed. In-app is always on.
//                                        A missing row means "email on" (the operator's per-event switch
//                                        still decides whether that event is offered at all).
//
// Notifications are scoped at read time by the project the event is about, so a project index on
// the metadata keeps that filter cheap.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS client_portal_thread_client_reads (
        thread_id    UUID                     NOT NULL REFERENCES client_portal_threads (id) ON DELETE CASCADE,
        contact_id   UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (thread_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_thread_client_reads_contact
        ON client_portal_thread_client_reads (contact_id);

    -- v1-shape compatibility: databases created before Client Portal v2
    -- already have client_portal_notification_reads in the v1 shape
    -- (client_id, organization_team_id, notification_type, reference_id),
    -- which lacks the v2 contact_id / notification_id columns. Creating
    -- the v2 table blindly would either fail later at the index below
    -- (the old table wins the IF NOT EXISTS) or leave v2 queries broken.
    -- Preserve the legacy table under a clearly named backup instead of
    -- dropping it: no production code reads the v1 columns anymore, but
    -- the rows are history worth keeping. Newer v2-shaped tables (or a
    -- missing table) need no action, so re-runs are safe. Resolution is
    -- search_path-aware so the check and the CREATE TABLE below always
    -- act on the same relation.
    DO $$
    DECLARE
        _rel regclass;
        _schema name;
    BEGIN
        SELECT to_regclass('client_portal_notification_reads') INTO _rel;
        IF _rel IS NULL THEN
            RETURN;
        END IF;
        SELECT n.nspname INTO _schema
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.oid = _rel;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = _schema
               AND table_name = 'client_portal_notification_reads'
               AND column_name = 'contact_id'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I.%I RENAME TO %I',
                _schema,
                'client_portal_notification_reads',
                'client_portal_notification_reads_legacy_v1'
            );
            EXECUTE format(
                'COMMENT ON TABLE %I.%I IS %L',
                _schema,
                'client_portal_notification_reads_legacy_v1',
                'Preserved v1 read-state (client_id, organization_team_id, notification_type, reference_id). Superseded by the v2 per-person columns in client_portal_notification_reads; kept by migration 1791454074122 instead of being dropped.'
            );
        END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS client_portal_notification_reads (
        notification_id UUID                     NOT NULL REFERENCES client_portal_notifications (id) ON DELETE CASCADE,
        contact_id      UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        read_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (notification_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_notification_reads_contact
        ON client_portal_notification_reads (contact_id);

    CREATE TABLE IF NOT EXISTS client_contact_notification_prefs (
        contact_id UUID                     NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
        event_type TEXT                     NOT NULL,
        email      BOOLEAN                  NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (contact_id, event_type),
        CONSTRAINT client_contact_notification_prefs_event_check
            CHECK (event_type IN ('approval_request', 'comment_or_reply', 'file_shared', 'milestone_change',
                                  'project_update', 'change_request_update', 'access_changes'))
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_notifications_project
        ON client_portal_notifications ((metadata ->> 'project_id'));

    COMMENT ON TABLE client_portal_thread_client_reads IS
      'Per client user: when they last opened each discussion thread. A thread is unread while it holds a client-visible message from someone else newer than this.';
    COMMENT ON TABLE client_portal_notification_reads IS
      'Per client user read state for client_portal_notifications. No row = unread.';
    COMMENT ON TABLE client_contact_notification_prefs IS
      'Per client user email preference per event. In-app notifications are always on; no row = email on.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Reverses only what the up migration creates. The v1 legacy backup
  // (client_portal_notification_reads_legacy_v1), when created by the up
  // migration, is deliberately left in place: dropping it would destroy
  // preserved read-state history. To restore the v1 shape manually after
  // this down migration, run:
  //   ALTER TABLE client_portal_notification_reads_legacy_v1
  //     RENAME TO client_portal_notification_reads;
  pgm.sql(`
    DROP INDEX IF EXISTS idx_client_portal_notifications_project;
    DROP TABLE IF EXISTS client_contact_notification_prefs;
    DROP TABLE IF EXISTS client_portal_notification_reads;
    DROP TABLE IF EXISTS client_portal_thread_client_reads;
  `);
};
