-- Tarea 50: el Paz y Salvo de Biblioteca ya no se sube; el sistema lo consulta en ALMA y lo guarda
-- como un documento sin archivo (origen CONSULTA). Repetible; los PDF ya cargados quedan como
-- histórico (origen ARCHIVO).
BEGIN;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'ARCHIVO';
ALTER TABLE documentos ALTER COLUMN nombre_original DROP NOT NULL;
ALTER TABLE documentos ALTER COLUMN mime_type DROP NOT NULL;
ALTER TABLE documentos ALTER COLUMN tamano_bytes DROP NOT NULL;
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS chk_documento_origen;
ALTER TABLE documentos ADD CONSTRAINT chk_documento_origen CHECK (origen IN ('ARCHIVO', 'CONSULTA'));
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS chk_documento_tamano;
ALTER TABLE documentos ADD CONSTRAINT chk_documento_tamano CHECK (tamano_bytes IS NULL OR tamano_bytes > 0);
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS chk_documento_archivo;
ALTER TABLE documentos ADD CONSTRAINT chk_documento_archivo CHECK (
    origen = 'CONSULTA' OR (nombre_original IS NOT NULL AND mime_type IS NOT NULL AND tamano_bytes > 0)
);
COMMIT;
