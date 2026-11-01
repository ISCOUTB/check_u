-- Tarea 44a: una convocatoria se identifica por su rango de recepción, no por su nombre.
-- No se eliminan ni fusionan registros existentes. Si hay duplicados, resolverlos antes de aplicar.
BEGIN;
LOCK TABLE periodos_grado IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM periodos_grado GROUP BY fecha_inicio, fecha_fin HAVING COUNT(*) > 1) THEN
        RAISE EXCEPTION 'Hay periodos con el mismo rango de recepción. Revise los duplicados antes de aplicar la migración 009; no se modificaron sus datos.';
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_periodos_grado_recepcion
    ON periodos_grado (fecha_inicio, fecha_fin);
COMMIT;
