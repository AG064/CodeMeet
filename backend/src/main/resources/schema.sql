CREATE EXTENSION IF NOT EXISTS postgis ^

ALTER TABLE IF EXISTS connections
DROP CONSTRAINT IF EXISTS connections_status_check ^

ALTER TABLE IF EXISTS connections
    ADD CONSTRAINT connections_status_check
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'SKIPPED', 'BLOCKED')) ^

ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS hide_location boolean DEFAULT false NOT NULL ^

ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS hide_age boolean DEFAULT false NOT NULL ^

    DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'hide_city'
    ) THEN
        EXECUTE 'UPDATE users SET hide_location = COALESCE(hide_city, false)';
END IF;
END $$ ^

ALTER TABLE IF EXISTS bios
    ADD COLUMN IF NOT EXISTS latitude double precision ^

ALTER TABLE IF EXISTS bios
    ADD COLUMN IF NOT EXISTS longitude double precision ^

ALTER TABLE IF EXISTS bios
    ADD COLUMN IF NOT EXISTS max_distance_km integer ^

ALTER TABLE IF EXISTS profiles
DROP COLUMN IF EXISTS is_online ^

ALTER TABLE IF EXISTS bios
    ADD COLUMN IF NOT EXISTS location geography(Point, 4326) ^

UPDATE bios
SET location = CASE
                   WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                   ELSE NULL
    END ^

CREATE OR REPLACE FUNCTION sync_bio_location() RETURNS trigger AS $$
BEGIN
    NEW.location = CASE
        WHEN NEW.longitude IS NOT NULL AND NEW.latitude IS NOT NULL THEN ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography
        ELSE NULL
END;
RETURN NEW;
END;
$$ LANGUAGE plpgsql ^

DROP TRIGGER IF EXISTS bios_sync_location ON bios ^

CREATE TRIGGER bios_sync_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON bios
    FOR EACH ROW
    EXECUTE FUNCTION sync_bio_location() ^
