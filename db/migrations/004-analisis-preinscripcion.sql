-- Tarea 36: se amplían tablas existentes. No contiene documentos ni resultados sintéticos.
ALTER TABLE validaciones ADD COLUMN IF NOT EXISTS detalle JSONB;
ALTER TABLE rutas ADD COLUMN IF NOT EXISTS expira_en TIMESTAMPTZ;
ALTER TABLE rutas ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;
ALTER TABLE rutas ADD COLUMN IF NOT EXISTS error_limpieza TEXT;
CREATE INDEX IF NOT EXISTS idx_rutas_expiracion ON rutas(expira_en) WHERE activa = TRUE;
