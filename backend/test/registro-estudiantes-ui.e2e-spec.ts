import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { crearDbBorrador } from './soporte/db-borrador.js';

/** Prueba optativa: Chromium y Next instalados en frontend; no intercepta HTTP. */
it.skipIf(process.env.ESTUDIANTES_UI_REAL !== '1')(
  'Tarea 55: navegador → Next → API Nest → PostgreSQL, sin respuestas simuladas',
  async () => {
    vi.stubEnv('AUTH_ESTUDIANTE_USERNAME', 'estudiante55@example.test');
    vi.stubEnv('AUTH_ESTUDIANTE_PASSWORD', 'Prueba-55-estudiante');
    vi.stubEnv('AUTH_FUNCIONARIO_USERNAME', 'funcionaria55@example.test');
    vi.stubEnv('AUTH_FUNCIONARIO_PASSWORD', 'Prueba-55-funcionaria');
    const base = await crearDbBorrador();
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(base.servicio)
      .compile();
    const app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    app.useLogger(false);
    app.enableCors({ origin: 'http://localhost:3005', credentials: true });
    const require = createRequire(import.meta.url);
    const { chromium, expect: esperar } =
      require('../../frontend/node_modules/@playwright/test') as typeof import('../../frontend/node_modules/@playwright/test/index.js');
    let next: ReturnType<typeof spawn> | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      await app.listen(3000, '0.0.0.0');
      next = spawn(
        process.execPath,
        [
          'node_modules/next/dist/bin/next',
          'dev',
          '--webpack',
          '-p',
          '3005',
          '-H',
          '0.0.0.0',
        ],
        {
          cwd: new URL('../../frontend/', import.meta.url),
          env: {
            ...process.env,
            NEXT_PUBLIC_API_URL: 'http://localhost:3000/api',
          },
          stdio: 'ignore',
        },
      );
      let listo = false;
      for (let intento = 0; intento < 150; intento++) {
        if (next.exitCode !== null)
          throw new Error('No pudo iniciar Next para la prueba.');
        try {
          if ((await fetch('http://localhost:3005')).ok) {
            listo = true;
            break;
          }
        } catch {
          /* Esperar a que Next abra el puerto. */
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      expect(listo).toBe(true);
      browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
        args: [
          '--no-sandbox',
          '--no-zygote',
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--in-process-gpu',
        ],
      });
      const contexto = await browser.newContext();
      const login = await contexto.request.post(
        'http://localhost:3000/api/auth/login',
        {
          data: {
            username: 'funcionaria55@example.test',
            password: 'Prueba-55-funcionaria',
          },
        },
      );
      expect(login.status()).toBe(201);
      const pagina = await contexto.newPage();
      await pagina.goto('http://localhost:3005/funcionario/dashboard');
      await pagina
        .getByRole('button', {
          name: 'Funcionario Funcionaria de grados',
          exact: true,
        })
        .click();
      await pagina
        .getByRole('link', { name: 'Registrar estudiantes', exact: true })
        .click();
      await pagina.getByLabel('Nombres', { exact: true }).fill('Ángela');
      await pagina.getByLabel('Apellidos', { exact: true }).fill('Peña');
      await pagina
        .getByLabel('Código estudiantil', { exact: true })
        .fill('t00550001');
      await pagina
        .getByLabel('Correo electrónico', { exact: true })
        .fill('angela@example.test');
      await pagina
        .getByRole('button', { name: 'Registrar estudiante', exact: true })
        .click();
      await esperar(pagina.getByRole('status')).toContainText(
        'Ángela Peña · Código T00550001',
      );
      await pagina.getByLabel('Archivo CSV').setInputFiles({
        name: 'estudiantes.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          'nombres;apellidos;codigo_estudiantil;correo;rol\nLuis;Pérez;T00550002;luis@example.test;ESTUDIANTE\nOtra;Persona;t00550001;otra@example.test;ESTUDIANTE\nSin;Permiso;T00550003;sin@example.test;FUNCIONARIO\n',
        ),
      });
      await pagina
        .getByRole('button', { name: 'Importar estudiantes', exact: true })
        .click();
      await esperar(pagina.getByRole('status').last()).toHaveText(
        '3 registros procesados. 1 registrados y 2 con errores.',
      );
      await esperar(pagina.getByRole('row').nth(2)).toContainText(
        'ya está registrado',
      );
      await esperar(pagina.getByRole('row').nth(3)).toContainText(
        'El rol debe ser ESTUDIANTE',
      );
      const creados = await base.db.query(
        'SELECT nombres,apellidos,codigo_estudiante,rol,correo FROM usuarios WHERE id_usuario > 2 ORDER BY id_usuario',
      );
      expect(creados.rows).toEqual([
        {
          nombres: 'Ángela',
          apellidos: 'Peña',
          codigo_estudiante: 'T00550001',
          rol: 'ESTUDIANTE',
          correo: 'angela@example.test',
        },
        {
          nombres: 'Luis',
          apellidos: 'Pérez',
          codigo_estudiante: 'T00550002',
          rol: 'ESTUDIANTE',
          correo: 'luis@example.test',
        },
      ]);
      await pagina.reload();
      await pagina.getByLabel('Nombres', { exact: true }).fill('Ángela');
      await pagina.getByLabel('Apellidos', { exact: true }).fill('Peña');
      await pagina
        .getByLabel('Código estudiantil', { exact: true })
        .fill('T00550001');
      await pagina
        .getByLabel('Correo electrónico', { exact: true })
        .fill('angela.nueva@example.test');
      await pagina
        .getByRole('button', { name: 'Registrar estudiante', exact: true })
        .click();
      await esperar(pagina.getByRole('main').getByRole('alert')).toContainText(
        'ya está registrado',
      );
      expect(
        (await base.db.query('SELECT * FROM usuarios WHERE id_usuario > 2'))
          .rows,
      ).toHaveLength(2);
      await contexto.close();
    } finally {
      await browser?.close();
      if (next) {
        const terminado = new Promise<void>((resolve) =>
          next!.once('exit', () => resolve()),
        );
        next.kill('SIGTERM');
        await Promise.race([
          terminado,
          new Promise((r) => setTimeout(r, 3000)),
        ]);
      }
      await app.close();
      await base.db.close();
      vi.unstubAllEnvs();
    }
  },
  120000,
);
