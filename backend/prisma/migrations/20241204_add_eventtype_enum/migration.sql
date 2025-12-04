-- AlterTable: Change eventType from String to Enum
-- Note: SQLite doesn't support native enums, so this is a documentation-only migration.
-- The Prisma Client enforces the enum constraint at application level.
-- Existing data already uses the correct format (e.g., "audio.start", "silence.detected").

-- No SQL changes needed for SQLite - enum constraint is enforced by Prisma Client.
-- This migration exists for documentation purposes only.

SELECT 1;
