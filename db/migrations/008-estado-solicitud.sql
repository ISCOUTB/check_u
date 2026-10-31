-- Tarea 42. Repetible sobre instalaciones existentes; no modifica resultados históricos.
-- ACEPTADA: la funcionaria aceptó una solicitud VALIDA (calculada). MANUAL y DOCUMENTO_RESUELTO:
-- la funcionaria resolvió un documento por revisar.
BEGIN;
ALTER TABLE solicitud_grado DROP CONSTRAINT IF EXISTS chk_estado_solicitud;
ALTER TABLE solicitud_grado ADD CONSTRAINT chk_estado_solicitud CHECK (
    estado IN ('BORRADOR', 'EN_PROCESO', 'POR_REVISAR', 'VALIDA', 'NO_VALIDA', 'INCONSISTENTE', 'ACEPTADA', 'CERRADA')
);
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
