-- Retire browser-play child capabilities. Preserve hashed token rows to allow
-- the parent PIN-only exit for an already locked browser after this migration.
-- Existing NATIVE child tokens and profiles MUST remain valid.
UPDATE "KidDeviceSession"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "clientKind" = 'WEB'
  AND "revokedAt" IS NULL;
