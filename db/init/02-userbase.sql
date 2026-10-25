-- CHECKU | Usuarios iniciales indicados por el equipo.
-- Configuración confirmada:
--   Lisandro Zapata: ESTUDIANTE, código T00000001.
--   Rosa Marriaga: FUNCIONARIO.
-- No se crean usuarios de ejemplo, perfiles ni solicitudes ficticias.
-- No se eliminan ni modifican usuarios que ya existan en una base desplegada.
-- El rol BIBLIOTECA no se utiliza; las funciones administrativas corresponden a FUNCIONARIO.

BEGIN;

INSERT INTO usuarios (nombres, apellidos, correo, rol, codigo_estudiante)
VALUES ('Lisandro', 'Zapata', 'lizapata@utb.edu.co', 'ESTUDIANTE', 'T00000001')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO usuarios (nombres, apellidos, correo, rol, codigo_estudiante)
VALUES ('Rosa', 'Marriaga', 'rmarriaga@utb.edu.co', 'FUNCIONARIO', NULL)
ON CONFLICT (correo) DO NOTHING;

COMMIT;