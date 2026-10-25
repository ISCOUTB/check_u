-- Tarea 28: aplicar sobre la DB existente; no elimina registros.
BEGIN;
ALTER TABLE solicitud_grado ADD COLUMN IF NOT EXISTS segundo_programa BOOLEAN;
-- NULL representa un campo todavía sin diligenciar. Los valores presentes siguen validados.
ALTER TABLE perfil_estudiante ALTER COLUMN tipo_documento_identidad DROP NOT NULL;
ALTER TABLE perfil_estudiante ALTER COLUMN numero_documento DROP NOT NULL;
ALTER TABLE solicitud_programa ALTER COLUMN programa DROP NOT NULL;
ALTER TABLE solicitud_programa ALTER COLUMN modalidad DROP NOT NULL;
ALTER TABLE informacion_pregrado DROP CONSTRAINT IF EXISTS chk_registro_saber_pro;
ALTER TABLE informacion_pregrado ADD CONSTRAINT chk_registro_saber_pro CHECK (
    numero_registro_saber_pro IS NULL OR
    (conoce_registro_saber_pro IS TRUE AND btrim(numero_registro_saber_pro) <> '')
);
-- La obligatoriedad del número cuando se responde Sí se comprueba al enviar.
COMMIT;
