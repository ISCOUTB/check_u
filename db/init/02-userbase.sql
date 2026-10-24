-- CHECKU | Usuarios iniciales indicados por el equipo.
-- Codigo de Lisandro confirmado para esta configuracion: T00000001.
-- No se agregan usuarios de ejemplo, perfiles ni solicitudes ficticias.
-- No elimina usuarios que ya existan en una base desplegada.
BEGIN;

INSERT INTO usuarios (nombres, apellidos, correo, rol, codigo_estudiante)
VALUES ('Lisandro', 'Zapata', 'lizapata@utb.edu.co', 'ESTUDIANTE', 'T00000001')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO usuarios (nombres, apellidos, correo, rol, codigo_estudiante)
VALUES ('Rosa', 'Marriaga', 'rmarriaga@utb.edu.co', 'FUNCIONARIO', NULL)
ON CONFLICT (correo) DO NOTHING;

COMMIT;
