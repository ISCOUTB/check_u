-- Reutilizar entregas permite auditar el reenvío sin sobrescribir documentos ni validaciones.
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS clave_idempotencia VARCHAR(128);
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS huella_envio VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uq_entrega_clave ON entregas(id_solicitud, clave_idempotencia)
WHERE clave_idempotencia IS NOT NULL;
