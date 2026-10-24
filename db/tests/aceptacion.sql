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
    IF tablas <> 12 THEN RAISE EXCEPTION 'Se esperaban 12 tablas, hay %', tablas; END IF;

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

    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET numero_registro_saber_pro=NULL WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET numero_registro_saber_pro=''  '' WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET conoce_registro_saber_pro=FALSE WHERE id_solicitud=%s', solicitud_p), '23514');
    UPDATE informacion_pregrado SET conoce_registro_saber_pro=FALSE, numero_registro_saber_pro=NULL WHERE id_solicitud=solicitud_p;
    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET es_empleado_utb=FALSE, tipo_contrato=''Temporal'' WHERE id_solicitud=%s', solicitud_p), '23514');
    PERFORM pg_temp.debe_rechazar(format('UPDATE informacion_pregrado SET es_empleado_utb=NULL, tipo_contrato=''Temporal'' WHERE id_solicitud=%s', solicitud_p), '23514');
    UPDATE informacion_pregrado SET es_empleado_utb=FALSE, tipo_contrato=NULL WHERE id_solicitud=solicitud_p;

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
    RAISE NOTICE 'ACEPTACION CORRECTA: 12 tablas, solo Lisandro y Rosa, restricciones y auditoria verificadas';
END;
$$;
ROLLBACK;
