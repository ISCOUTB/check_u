-- Verificacion reproducible. Ejecutar despues de 01-schema y 02-userbase.
-- No deja datos de prueba adicionales: todo se revierte al final.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.debe_rechazar(consulta TEXT, codigo_esperado TEXT)
RETURNS VOID AS $$
BEGIN
    BEGIN
        EXECUTE consulta;
    EXCEPTION WHEN integrity_constraint_violation THEN
        IF SQLSTATE <> ALL(string_to_array(codigo_esperado, ',')) THEN
            RAISE EXCEPTION 'SQLSTATE esperado %, recibido %: %',
                codigo_esperado, SQLSTATE, SQLERRM;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'La consulta debio ser rechazada: %', consulta;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    estudiante INTEGER;
    solicitud_p INTEGER;
    solicitud_g INTEGER;
    fecha_anterior TIMESTAMPTZ;
    tablas INTEGER;
    filas INTEGER;
    prueba TEXT;
BEGIN
    SELECT COUNT(*) INTO tablas FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    IF tablas <> 17 THEN RAISE EXCEPTION 'Se esperaban 17 tablas, hay %', tablas; END IF;

    SELECT id_usuario INTO STRICT estudiante FROM usuarios
    WHERE correo = 'lizapata@utb.edu.co' AND rol = 'ESTUDIANTE'
      AND codigo_estudiante = 'T00000001';
    IF (SELECT COUNT(*) FROM usuarios) <> 2 THEN
        RAISE EXCEPTION 'Se esperaban solo los dos usuarios indicados por el equipo';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE nombres='Rosa' AND apellidos='Marriaga'
        AND correo='rmarriaga@utb.edu.co' AND rol='FUNCIONARIO') THEN
        RAISE EXCEPTION 'Falta la funcionaria Rosa Marriaga';
    END IF;
    IF EXISTS (SELECT 1 FROM perfil_estudiante)
       OR EXISTS (SELECT 1 FROM solicitud_grado)
       OR EXISTS (SELECT 1 FROM solicitud_programa)
       OR EXISTS (SELECT 1 FROM informacion_pregrado)
       OR EXISTS (SELECT 1 FROM informacion_posgrado)
       OR EXISTS (SELECT 1 FROM experiencia_laboral) THEN
        RAISE EXCEPTION 'La inicializacion debe cargar solo usuarios, sin datos inventados';
    END IF;

    -- Tarea 40: los cinco campos administrables traen sus opciones iniciales.
    IF (SELECT COUNT(DISTINCT campo) FROM opciones_campo) <> 5 THEN
        RAISE EXCEPTION 'Faltan campos en opciones_campo';
    END IF;
    IF (SELECT COUNT(*) FROM opciones_campo) <> 31 THEN
        RAISE EXCEPTION 'Se esperaban 31 opciones iniciales, hay %',
            (SELECT COUNT(*) FROM opciones_campo);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM opciones_campo
        WHERE campo = 'PROGRAMA' AND valor = 'INGENIERIA_DE_SISTEMAS_Y_COMPUTACION'
          AND etiqueta = 'Ingeniería de Sistemas y Computación' AND orden = 1
    ) THEN
        RAISE EXCEPTION 'Falta el programa inicial de Ingeniería de Sistemas';
    END IF;

    -- Fixtures de prueba: SOLO dentro de esta transaccion, que termina en ROLLBACK.
    -- Estos valores no describen a Lisandro y no forman parte de los datos iniciales.
    INSERT INTO perfil_estudiante(id_usuario,tipo_documento_identidad,numero_documento)
    VALUES (estudiante, 'PRUEBA', 'DEMO10001');
    INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud)
    VALUES (estudiante, 'PREGRADO') RETURNING id_solicitud INTO solicitud_p;
    INSERT INTO solicitud_grado(id_estudiante,tipo_solicitud)
    VALUES (estudiante, 'POSGRADO') RETURNING id_solicitud INTO solicitud_g;
    INSERT INTO solicitud_programa(id_solicitud,orden,programa,modalidad,tipo_opcion_grado)
    VALUES (solicitud_p,1,'Programa de prueba 1','PRESENCIAL','Opcion de prueba'),
           (solicitud_p,2,'Programa de prueba 2','VIRTUAL','Opcion de prueba'),
           (solicitud_g,1,'Programa de prueba posgrado','VIRTUAL',NULL);
    INSERT INTO informacion_pregrado(id_solicitud,conoce_registro_saber_pro,
        numero_registro_saber_pro,es_empleado_utb,tipo_contrato)
    VALUES (solicitud_p,TRUE,'REGISTRODEPRUEBA',TRUE,'Contrato de prueba');
    INSERT INTO informacion_posgrado(id_solicitud) VALUES (solicitud_g);
    INSERT INTO experiencia_laboral(id_solicitud,orden,empresa,cargo,tiempo)
    VALUES (solicitud_g,1,'Empresa de prueba 1','Cargo 1','2 anos'),
           (solicitud_g,2,'Empresa de prueba 2','Cargo 2','1 ano');

    -- Rol ESTUDIANTE requiere codigo y el codigo es unico si no es NULL.
    PERFORM pg_temp.debe_rechazar($q$INSERT INTO usuarios
        (nombres,apellidos,correo,rol) VALUES ('Prueba','Sin codigo','sin-codigo@checku.example','ESTUDIANTE')$q$, '23514');
    PERFORM pg_temp.debe_rechazar($q$INSERT INTO usuarios
        (nombres,apellidos,correo,rol,codigo_estudiante)
        VALUES ('Prueba','Vacio','vacio@checku.example','ESTUDIANTE','   ')$q$, '23514');
    PERFORM pg_temp.debe_rechazar($q$INSERT INTO usuarios
        (nombres,apellidos,correo,rol,codigo_estudiante)
        VALUES ('Prueba','Duplicado','duplicado@checku.example','ESTUDIANTE','T00000001')$q$, '23505');

    FOREACH prueba IN ARRAY ARRAY['1.234', '1,234', '1 234', E'1\t234', ''] LOOP
        PERFORM pg_temp.debe_rechazar(format(
            'UPDATE perfil_estudiante SET numero_documento=%L WHERE id_usuario=%s', prueba, estudiante), '23514');
    END LOOP;
    UPDATE perfil_estudiante SET numero_documento = 'ABC123' WHERE id_usuario = estudiante;
    PERFORM pg_temp.debe_rechazar(format(
        'INSERT INTO perfil_estudiante(id_usuario,tipo_documento_identidad,numero_documento)
         SELECT id_usuario,''PRUEBA'',''ABC123'' FROM usuarios WHERE correo=''rmarriaga@utb.edu.co''
         ON CONFLICT(id_usuario) DO UPDATE SET tipo_documento_identidad=''PRUEBA'', numero_documento=''ABC123'''), '23505');

    -- Discapacidad y asistencia (Tarea 37): respuesta principal y dependientes coherentes.
    UPDATE perfil_estudiante SET tiene_discapacidad = NULL, tipo_discapacidad = NULL,
        detalles_necesidades_asistencia = NULL WHERE id_usuario = estudiante;
    UPDATE perfil_estudiante SET tiene_discapacidad = FALSE WHERE id_usuario = estudiante;
    PERFORM pg_temp.debe_rechazar(format(
        'UPDATE perfil_estudiante SET tipo_discapacidad = ''FISICA'' WHERE id_usuario=%s',
        estudiante), '23514');
    PERFORM pg_temp.debe_rechazar(format(
        'UPDATE perfil_estudiante SET detalles_necesidades_asistencia = ''Rampa'' WHERE id_usuario=%s',
        estudiante), '23514');
    PERFORM pg_temp.debe_rechazar(format(
        'UPDATE perfil_estudiante SET tiene_discapacidad = TRUE WHERE id_usuario=%s',
        estudiante), '23514');
    PERFORM pg_temp.debe_rechazar(format(
        'UPDATE perfil_estudiante SET tiene_discapacidad = TRUE, tipo_discapacidad = ''   '' WHERE id_usuario=%s',
        estudiante), '23514');
    -- Tarea 40: el catálogo de tipos de discapacidad ya no está cerrado en el perfil.
    UPDATE perfil_estudiante SET tiene_discapacidad = TRUE, tipo_discapacidad = 'AUDITIVA'
        WHERE id_usuario = estudiante;
    -- Afirmativa válida: el tipo es obligatorio, los detalles son opcionales.
    UPDATE perfil_estudiante SET tiene_discapacidad = TRUE, tipo_discapacidad = 'SENSORIAL',
        detalles_necesidades_asistencia = NULL WHERE id_usuario = estudiante;
    UPDATE perfil_estudiante SET detalles_necesidades_asistencia = 'Acceso sin escaleras'
        WHERE id_usuario = estudiante;
    PERFORM pg_temp.debe_rechazar(format(
        'UPDATE perfil_estudiante SET detalles_necesidades_asistencia = ''   '' WHERE id_usuario=%s',
        estudiante), '23514');
    PERFORM pg_temp.debe_rechazar(format(
        'UPDATE perfil_estudiante SET tiene_discapacidad = NULL WHERE id_usuario=%s',
        estudiante), '23514');
    PERFORM pg_temp.debe_rechazar(format(
        'UPDATE perfil_estudiante SET tiene_discapacidad = FALSE WHERE id_usuario=%s',
        estudiante), '23514');
    UPDATE perfil_estudiante SET tiene_discapacidad = FALSE, tipo_discapacidad = NULL,
        detalles_necesidades_asistencia = NULL WHERE id_usuario = estudiante;

    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET numero_registro_saber_pro=NULL WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET numero_registro_saber_pro=''  '' WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET conoce_registro_saber_pro=FALSE WHERE id_solicitud=%s', solicitud_p), '23514');
    UPDATE informacion_pregrado SET conoce_registro_saber_pro=FALSE, numero_registro_saber_pro=NULL WHERE id_solicitud=solicitud_p;
    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET es_empleado_utb=FALSE, tipo_contrato=''Temporal'' WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET es_empleado_utb=NULL, tipo_contrato=''Temporal'' WHERE id_solicitud=%s', solicitud_p), '23514');
    UPDATE informacion_pregrado SET es_empleado_utb=FALSE, tipo_contrato=NULL WHERE id_solicitud=solicitud_p;

    -- Tarea 42: ACEPTADA es un estado de la solicitud; un estado desconocido se rechaza.
    SELECT estado INTO prueba FROM solicitud_grado WHERE id_solicitud = solicitud_p;
    UPDATE solicitud_grado SET estado = 'ACEPTADA' WHERE id_solicitud = solicitud_p;
    UPDATE solicitud_grado SET estado = prueba WHERE id_solicitud = solicitud_p;
    PERFORM pg_temp.debe_rechazar(format('UPDATE solicitud_grado SET estado=''APROBADA'' WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('INSERT INTO revisiones(id_solicitud,id_funcionario,resultado) SELECT %s,id_usuario,''DESCONOCIDO'' FROM usuarios WHERE rol=''FUNCIONARIO''', solicitud_p), '23514');

    PERFORM pg_temp.debe_rechazar(format('INSERT INTO solicitud_programa(id_solicitud,orden,programa,modalidad) VALUES (%s,3,''Tercero'',''VIRTUAL'')', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('INSERT INTO solicitud_programa(id_solicitud,orden,programa,modalidad) VALUES (%s,1,''Repetido'',''VIRTUAL'')', solicitud_p), '23505');
    PERFORM pg_temp.debe_rechazar(format('UPDATE solicitud_programa SET modalidad=''HIBRIDA'' WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('UPDATE solicitud_programa SET tipo_opcion_grado=''Tesis'' WHERE id_solicitud=%s', solicitud_g), '23514');
    PERFORM pg_temp.debe_rechazar(format('INSERT INTO experiencia_laboral(id_solicitud,orden) VALUES (%s,3)', solicitud_g), '23514');
    PERFORM pg_temp.debe_rechazar(format('INSERT INTO experiencia_laboral(id_solicitud,orden) VALUES (%s,1)', solicitud_g), '23505');
    PERFORM pg_temp.debe_rechazar(format('INSERT INTO experiencia_laboral(id_solicitud,orden) VALUES (%s,1)', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('INSERT INTO informacion_posgrado(id_solicitud) VALUES (%s)', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('UPDATE solicitud_grado SET tipo_solicitud=''POSGRADO'' WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('DELETE FROM solicitud_grado WHERE id_solicitud=%s', solicitud_p), '23503,23001');

    -- Todas las fechas de auditoria tienen zona; las de calendario son DATE.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
       AND column_name IN ('fecha_creacion','fecha_actualizacion','fecha_carga','fecha_validacion','fecha_cambio','fecha_revision')
       AND data_type <> 'timestamp with time zone') THEN RAISE EXCEPTION 'Auditoria sin TIMESTAMPTZ'; END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
       AND column_name IN ('fecha_nacimiento','fecha_examen_saber_pro')
       AND data_type <> 'date') THEN RAISE EXCEPTION 'Fecha de calendario incorrecta'; END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
       AND (column_name ILIKE '%password%' OR column_name ILIKE '%contrasena%'))
       THEN RAISE EXCEPTION 'No se permiten credenciales en las tablas'; END IF;

    -- Validar que el trigger reemplace una fecha enviada por el cliente.
    UPDATE perfil_estudiante SET fecha_actualizacion = TIMESTAMPTZ '2000-01-01 00:00:00+00'
    WHERE id_usuario = estudiante;
    SELECT fecha_actualizacion INTO fecha_anterior FROM perfil_estudiante WHERE id_usuario=estudiante;
    IF fecha_anterior <> CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'No funciona trigger de auditoria'; END IF;
    RAISE NOTICE 'ACEPTACION CORRECTA: 17 tablas, solo Lisandro y Rosa, restricciones y auditoria verificadas';
END;
$$;
ROLLBACK;
