-- Tarea 44: cancelación lógica, irreversible y auditable. No elimina solicitudes ni archivos.
BEGIN;
ALTER TABLE solicitud_grado DROP CONSTRAINT IF EXISTS chk_estado_solicitud;
ALTER TABLE solicitud_grado ADD CONSTRAINT chk_estado_solicitud CHECK (
    estado IN ('BORRADOR','EN_PROCESO','POR_REVISAR','VALIDA','NO_VALIDA','INCONSISTENTE','CERRADA','CANCELADA')
);
CREATE TABLE IF NOT EXISTS cancelaciones_preinscripcion (
    id_solicitud INTEGER PRIMARY KEY REFERENCES solicitud_grado(id_solicitud) ON DELETE RESTRICT,
    id_estudiante INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    estado_anterior VARCHAR(30) NOT NULL CHECK (estado_anterior='EN_PROCESO'),
    fecha_cancelacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    informacion_estudiante JSONB NOT NULL CHECK (jsonb_typeof(informacion_estudiante)='object')
);
CREATE OR REPLACE FUNCTION checku_controlar_cancelacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.estado='CANCELADA' AND (NEW.estado<>OLD.estado OR NEW.id_estudiante<>OLD.id_estudiante
      OR NEW.id_periodo IS DISTINCT FROM OLD.id_periodo OR NEW.tipo_solicitud<>OLD.tipo_solicitud) THEN
        RAISE EXCEPTION 'Una preinscripción cancelada no puede reactivarse ni reasignarse';
    END IF;
    IF NEW.estado='CANCELADA' AND OLD.estado NOT IN ('EN_PROCESO','CANCELADA') THEN
        RAISE EXCEPTION 'Solo se puede cancelar una preinscripción en proceso';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION checku_registrar_cancelacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado='CANCELADA' AND OLD.estado<>'CANCELADA' THEN
        INSERT INTO cancelaciones_preinscripcion(id_solicitud,id_estudiante,estado_anterior,informacion_estudiante)
        SELECT NEW.id_solicitud,NEW.id_estudiante,OLD.estado,to_jsonb(u)||COALESCE(to_jsonb(p),'{}'::jsonb)
        FROM usuarios u LEFT JOIN perfil_estudiante p ON p.id_usuario=u.id_usuario
        WHERE u.id_usuario=NEW.id_estudiante;
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION checku_conservar_cancelacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'El registro histórico de cancelación no se modifica ni elimina';
END $$;
DROP TRIGGER IF EXISTS trg_solicitud_control_cancelacion ON solicitud_grado;
CREATE TRIGGER trg_solicitud_control_cancelacion BEFORE UPDATE ON solicitud_grado FOR EACH ROW EXECUTE FUNCTION checku_controlar_cancelacion();
DROP TRIGGER IF EXISTS trg_solicitud_registrar_cancelacion ON solicitud_grado;
CREATE TRIGGER trg_solicitud_registrar_cancelacion AFTER UPDATE OF estado ON solicitud_grado FOR EACH ROW EXECUTE FUNCTION checku_registrar_cancelacion();
DROP TRIGGER IF EXISTS trg_cancelacion_inmutable ON cancelaciones_preinscripcion;
CREATE TRIGGER trg_cancelacion_inmutable BEFORE UPDATE OR DELETE ON cancelaciones_preinscripcion FOR EACH ROW EXECUTE FUNCTION checku_conservar_cancelacion();
COMMIT;
