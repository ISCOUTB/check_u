-- Tarea 55: estudiantes base con correo pendiente y código estudiantil único normalizado.
BEGIN;
LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM usuarios WHERE codigo_estudiante IS NOT NULL
               GROUP BY upper(btrim(codigo_estudiante)) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Hay códigos estudiantiles duplicados al ignorar espacios externos y mayúsculas. Revise los registros antes de aplicar la migración 011.';
    END IF;
END $$;
ALTER TABLE usuarios ALTER COLUMN correo DROP NOT NULL;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_usuarios_estudiante_con_codigo;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuarios_correo_por_rol' AND conrelid = 'usuarios'::regclass) THEN
        ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_correo_por_rol
            CHECK (rol = 'ESTUDIANTE' OR correo IS NOT NULL);
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_codigo_normalizado
    ON usuarios (upper(btrim(codigo_estudiante))) WHERE codigo_estudiante IS NOT NULL;
COMMIT;
