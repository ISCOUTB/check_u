INSERT INTO usuarios (nombres, apellidos, correo, rol)
VALUES ('Lisandro', 'Zapata', 'lizapata@utb.edu.co', 'ESTUDIANTE')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO usuarios (nombres, apellidos, correo, rol)
VALUES ('Rosa', 'Marriaga', 'rmarriaga@utb.edu.co', 'FUNCIONARIO')
ON CONFLICT (correo) DO NOTHING;