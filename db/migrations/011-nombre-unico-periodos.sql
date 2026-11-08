-- Tarea 61: el nombre de un periodo de grado debe ser único (insensible a mayúsculas, tildes y espacios).
-- No se eliminan ni fusionan registros existentes. Si hay duplicados, resolverlos antes de aplicar.
BEGIN;
LOCK TABLE periodos_grado IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM periodos_grado
        GROUP BY btrim(regexp_replace(translate(lower(nombre), 'áéíóúüñ', 'aeiouun'), '\s+', ' ', 'g'))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Hay periodos con el mismo nombre normalizado. Revise los duplicados antes de aplicar la migración 011; no se modificaron sus datos.';
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_periodos_grado_nombre
    ON periodos_grado (btrim(regexp_replace(translate(lower(nombre), 'áéíóúüñ', 'aeiouun'), '\s+', ' ', 'g')));
COMMIT;
