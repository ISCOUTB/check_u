-- Tarea 54b: Separar los programas académicos de Pregrado y Posgrado.
-- Idempotente: actualiza restricciones, migra 'PROGRAMA' a 'PROGRAMA_PREGRADO' y siembra opciones iniciales de posgrado.
BEGIN;

ALTER TABLE opciones_campo DROP CONSTRAINT IF EXISTS chk_opciones_campo_campo;
ALTER TABLE opciones_campo ADD CONSTRAINT chk_opciones_campo_campo CHECK (
    campo IN ('TIPO_DOCUMENTO', 'GENERO', 'PROGRAMA', 'PROGRAMA_PREGRADO', 'PROGRAMA_POSGRADO', 'OPCION_GRADO', 'TIPO_DISCAPACIDAD')
);

UPDATE opciones_campo SET campo = 'PROGRAMA_PREGRADO' WHERE campo = 'PROGRAMA';

INSERT INTO opciones_campo (campo, valor, etiqueta, orden) VALUES
    ('PROGRAMA_POSGRADO', 'MAESTRIA_EN_INGENIERIA', 'Maestría en Ingeniería', 1),
    ('PROGRAMA_POSGRADO', 'MAESTRIA_EN_ADMINISTRACION_DE_EMPRESAS', 'Maestría en Administración de Empresas', 2),
    ('PROGRAMA_POSGRADO', 'ESPECIALIZACION_EN_GESTION_DE_PROYECTOS', 'Especialización en Gestión de Proyectos', 3),
    ('PROGRAMA_POSGRADO', 'ESPECIALIZACION_EN_FINANZAS', 'Especialización en Finanzas', 4),
    ('PROGRAMA_POSGRADO', 'DOCTORADO_EN_INGENIERIA', 'Doctorado en Ingeniería', 5)
ON CONFLICT DO NOTHING;

COMMIT;
