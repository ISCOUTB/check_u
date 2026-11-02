import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { crearDbBorrador } from './soporte/db-borrador.js';
it.skipIf(process.env.PERIODOS_UI_REAL !== '1')(
  'Tarea 44a: navegador con API y PostgreSQL sin interceptar HTTP',
  async () => {
    const base = await crearDbBorrador();
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(base.servicio)
      .compile();
    const app = m.createNestApplication();
    app.setGlobalPrefix('api');
    app.useLogger(false);
    app.enableCors({ origin: 'http://127.0.0.1:3005', credentials: true });
    const require = createRequire(import.meta.url);
    const {
      chromium,
      expect: esperar,
    } = require('../../frontend/node_modules/@playwright/test');
    let next: ReturnType<typeof spawn> | undefined, browser;
    try {
      await app.listen(3000, '127.0.0.1');
      next = spawn(
        process.execPath,
        [
          'node_modules/next/dist/bin/next',
          'dev',
          '--webpack',
          '-p',
          '3005',
          '-H',
          '127.0.0.1',
        ],
        {
          cwd: new URL('../../frontend/', import.meta.url),
          env: {
            ...process.env,
            NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3000/api',
          },
          stdio: 'ignore',
        },
      );
      let listo = false;
      for (let n = 0; n < 120; n++) {
        if (next.exitCode !== null) throw new Error('No pudo iniciar Next.');
        try {
          if ((await fetch('http://127.0.0.1:3005')).ok) {
            listo = true;
            break;
          }
        } catch {
          /* esperar arranque */
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
        'http://127.0.0.1:3000/api/auth/login',
        { data: { username: 'rmarriaga@utb.edu.co', password: '12345' } },
      );
      expect(login.status()).toBe(201);
      const pagina = await contexto.newPage();
      await pagina.goto('http://127.0.0.1:3005/funcionario/dashboard');
      await pagina.getByRole('button', { name: 'Gestionar periodos' }).click();
      const dialogo = pagina.getByRole('dialog', {
        name: 'Gestión de periodos de grado',
      });
      await dialogo.getByLabel('Nombre del periodo').fill('Convocatoria real');
      await dialogo
        .getByLabel('Fecha de inicio', { exact: true })
        .fill('2026-10-23');
      await dialogo.getByLabel('Fecha de finalización').fill('2026-11-30');
      await dialogo.getByLabel('Fecha de graduación').fill('2026-11-15');
      await dialogo
        .getByRole('button', { name: 'Registrar periodo', exact: true })
        .click();
      await esperar(dialogo.getByRole('alert')).toContainText(
        'graduación debe ser posterior',
      );
      expect(
        (await base.db.query('SELECT * FROM periodos_grado')).rows,
      ).toHaveLength(0);
      await dialogo.getByLabel('Fecha de graduación').fill('2026-12-05');
      await dialogo
        .getByRole('button', { name: 'Registrar periodo', exact: true })
        .click();
      await esperar(dialogo.getByRole('status')).toHaveText(
        'Periodo guardado correctamente.',
      );
      await esperar(
        dialogo.getByRole('list', { name: 'Periodos de grado registrados' }),
      ).toContainText('Convocatoria real');
      await dialogo
        .getByRole('button', { name: 'Editar Convocatoria real' })
        .click();
      await dialogo
        .getByLabel('Nombre del periodo')
        .fill('Convocatoria editada');
      await dialogo
        .getByRole('button', { name: 'Guardar cambios', exact: true })
        .click();
      await esperar(
        dialogo.getByRole('list', { name: 'Periodos de grado registrados' }),
      ).toContainText('Convocatoria editada');
      // El catálogo del navegador no conoce esta creación posterior: debe resolverla el backend.
      const segundo = await contexto.request.post(
        'http://127.0.0.1:3000/api/periodos-grado',
        {
          data: {
            nombre: 'Concurrente',
            fechaInicio: '2026-11-01',
            fechaFin: '2026-11-30',
            fechaGraduacion: '2026-12-05',
          },
        },
      );
      expect(segundo.status()).toBe(201);
      await dialogo.getByLabel('Nombre del periodo').fill('Intento repetido');
      await dialogo
        .getByLabel('Fecha de inicio', { exact: true })
        .fill('2026-11-01');
      await dialogo.getByLabel('Fecha de finalización').fill('2026-11-30');
      await dialogo.getByLabel('Fecha de graduación').fill('2026-12-06');
      const respuesta = pagina.waitForResponse(
        (r) =>
          r.url().endsWith('/api/periodos-grado') &&
          r.request().method() === 'POST',
      );
      await dialogo
        .getByRole('button', { name: 'Registrar periodo', exact: true })
        .click();
      expect((await respuesta).status()).toBe(409);
      await esperar(dialogo.getByRole('alert')).toContainText(
        'Ya existe un periodo con estas fechas',
      );
      await esperar(dialogo.getByLabel('Nombre del periodo')).toHaveValue(
        'Intento repetido',
      );
      expect(
        (
          await base.db.query(
            'SELECT nombre,fecha_inicio::text,fecha_fin::text,fecha_graduacion::text FROM periodos_grado ORDER BY fecha_inicio',
          )
        ).rows,
      ).toEqual([
        {
          nombre: 'Convocatoria editada',
          fecha_inicio: '2026-10-23',
          fecha_fin: '2026-11-30',
          fecha_graduacion: '2026-12-05',
        },
        {
          nombre: 'Concurrente',
          fecha_inicio: '2026-11-01',
          fecha_fin: '2026-11-30',
          fecha_graduacion: '2026-12-05',
        },
      ]);
      await contexto.close();
    } finally {
      await browser?.close();
      next?.kill('SIGTERM');
      await app.close();
      await base.db.close();
    }
  },
  120000,
);
