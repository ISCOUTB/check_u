-- Tarea 42. Repetible sobre instalaciones existentes; va después de 008-cancelacion-preinscripcion.
-- ACEPTADA: la funcionaria aceptó una solicitud VALIDA (calculada). MANUAL y DOCUMENTO_RESUELTO:
-- la funcionaria resolvió un documento por revisar.
BEGIN;
ALTER TABLE solicitud_grado DROP CONSTRAINT IF EXISTS chk_estado_solicitud;
ALTER TABLE solicitud_grado ADD CONSTRAINT chk_estado_solicitud CHECK (
    estado IN ('BORRADOR', 'EN_PROCESO', 'POR_REVISAR', 'VALIDA', 'NO_VALIDA', 'INCONSISTENTE', 'ACEPTADA', 'CERRADA', 'CANCELADA')
);
-- Antes de la Tarea 42, aceptar escribía VALIDA (con su revisión APROBADA). Desde ahora VALIDA es el
-- estado calculado y la aceptación es ACEPTADA: esas solicitudes no deben poder aceptarse de nuevo.
UPDATE solicitud_grado s SET estado = 'ACEPTADA'
WHERE s.estado = 'VALIDA'
  AND EXISTS (SELECT 1 FROM revisiones r WHERE r.id_solicitud = s.id_solicitud AND r.resultado = 'APROBADA');

-- Tarea 44 con el estado calculado: «en proceso» es toda solicitud enviada que la funcionaria no ha
-- decidido. El estado ya no se queda en EN_PROCESO después del envío.
ALTER TABLE cancelaciones_preinscripcion DROP CONSTRAINT IF EXISTS cancelaciones_preinscripcion_estado_anterior_check;
ALTER TABLE cancelaciones_preinscripcion DROP CONSTRAINT IF EXISTS chk_cancelacion_estado_anterior;
ALTER TABLE cancelaciones_preinscripcion ADD CONSTRAINT chk_cancelacion_estado_anterior
    CHECK (estado_anterior IN ('EN_PROCESO','POR_REVISAR','NO_VALIDA','INCONSISTENTE','VALIDA'));
CREATE OR REPLACE FUNCTION checku_controlar_cancelacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.estado='CANCELADA' AND (NEW.estado<>OLD.estado OR NEW.id_estudiante<>OLD.id_estudiante
      OR NEW.id_periodo IS DISTINCT FROM OLD.id_periodo OR NEW.tipo_solicitud<>OLD.tipo_solicitud) THEN
        RAISE EXCEPTION 'Una preinscripción cancelada no puede reactivarse ni reasignarse';
    END IF;
    IF NEW.estado='CANCELADA' AND OLD.estado NOT IN ('EN_PROCESO','POR_REVISAR','NO_VALIDA','INCONSISTENTE','VALIDA','CANCELADA') THEN
        RAISE EXCEPTION 'Solo se puede cancelar una preinscripción en proceso';
    END IF;
    RETURN NEW;
END $$;

ALTER TABLE validaciones DROP CONSTRAINT IF EXISTS chk_validacion_tipo;
ALTER TABLE validaciones ADD CONSTRAINT chk_validacion_tipo CHECK (
    tipo_validacion IN ('OCR', 'INTEGRIDAD', 'CONSISTENCIA', 'REQUISITOS', 'FIRMA_CRIPTOGRAFICA', 'MANUAL')
);
ALTER TABLE revisiones DROP CONSTRAINT IF EXISTS chk_revision_resultado;
ALTER TABLE revisiones ADD CONSTRAINT chk_revision_resultado CHECK (
    resultado IN ('APROBADA', 'CORRECCION_REQUERIDA', 'RECHAZADA', 'POR_REVISAR', 'DOCUMENTO_RESUELTO')
);

CREATE OR REPLACE FUNCTION notificar_revision() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE estudiante INTEGER; lista TEXT; total INTEGER; clase TEXT; encabezado TEXT; mensaje TEXT; estado_doc TEXT;
BEGIN
    IF NOT EXISTS(SELECT 1 FROM usuarios WHERE id_usuario=NEW.id_funcionario AND rol='FUNCIONARIO') THEN
        RAISE EXCEPTION 'La revisión requiere un funcionario';
    END IF;
    SELECT id_estudiante INTO estudiante FROM solicitud_grado WHERE id_solicitud=NEW.id_solicitud;
    IF NEW.resultado='APROBADA' THEN
        clase:='info'; encabezado:='Solicitud aceptada'; mensaje:='Tu solicitud de grado fue aceptada.';
    ELSIF NEW.resultado='RECHAZADA' THEN
        clase:='error'; encabezado:='Solicitud anulada'; mensaje:='Tu solicitud fue anulada. Incumpliste ciertos requisitos.';
    ELSIF NEW.resultado='CORRECCION_REQUERIDA' THEN
        IF COALESCE(cardinality(NEW.documentos_ids),0)=0 THEN RAISE EXCEPTION 'Selecciona los documentos de la corrección'; END IF;
        SELECT count(*), string_agg(nombre_documento_notificacion(d.tipo_documento,d.orden), ', ' ORDER BY d.tipo_documento,d.orden)
        INTO total,lista FROM documentos d WHERE d.id_solicitud=NEW.id_solicitud AND d.id_documento=ANY(NEW.documentos_ids) AND d.id_entrega IS NOT NULL;
        IF total<>cardinality(NEW.documentos_ids) THEN RAISE EXCEPTION 'Documentos de revisión inválidos'; END IF;
        clase:='warning'; encabezado:='Documentos por volver a subir';
        mensaje:='La funcionaria confirmó que necesitas volver a subir estos documentos: '||lista||'.';
    ELSIF NEW.resultado='DOCUMENTO_RESUELTO' THEN
        IF COALESCE(cardinality(NEW.documentos_ids),0)<>1 THEN RAISE EXCEPTION 'La resolución debe indicar un documento'; END IF;
        SELECT d.estado, nombre_documento_notificacion(d.tipo_documento,d.orden) INTO estado_doc,lista
        FROM documentos d WHERE d.id_solicitud=NEW.id_solicitud AND d.id_documento=NEW.documentos_ids[1] AND d.id_entrega IS NOT NULL;
        IF NOT FOUND THEN RAISE EXCEPTION 'Documentos de revisión inválidos'; END IF;
        IF estado_doc='VALIDO' THEN
            clase:='success'; encabezado:='Documento validado'; mensaje:='La funcionaria validó: '||lista||'.';
        ELSE
            clase:='error'; encabezado:='Documento no válido';
            mensaje:='La funcionaria marcó como no válido: '||lista||'.'||COALESCE(' '||NULLIF(btrim(NEW.comentario),''),'');
        END IF;
    ELSIF NEW.resultado='POR_REVISAR' AND COALESCE(btrim(NEW.comentario),'')<>'' THEN
        clase:='info'; encabezado:='Nuevo comentario';
        mensaje:='La funcionaria te dejó un comentario: '||left(NEW.comentario,15)||CASE WHEN char_length(NEW.comentario)>15 THEN '…' ELSE '' END;
    ELSE RETURN NEW;
    END IF;
    PERFORM crear_notificacion(estudiante,clase,encabezado,mensaje,'funcionario','revision:'||NEW.id_revision,NEW.id_solicitud,NULL,NEW.id_revision);
    RETURN NEW;
END $$;
COMMIT;
