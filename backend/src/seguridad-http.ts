import type { NestExpressApplication } from '@nestjs/platform-express';
import type { RequestHandler } from 'express';
import helmet from 'helmet';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function configurarSeguridadHttp(app: NestExpressApplication) {
  const produccion = process.env.NODE_ENV === 'production';
  const origenFrontend =
    process.env.CHECKU_FRONTEND_ORIGIN?.trim() || 'https://checku.iscoutb.dev';
  const url = URL.parse(origenFrontend);
  if (
    !url ||
    url.origin !== origenFrontend ||
    (url.protocol !== 'https:' && (produccion || url.protocol !== 'http:'))
  ) {
    throw new Error(
      'CHECKU_FRONTEND_ORIGIN debe ser un origen HTTP(S) sin ruta y usar HTTPS en producción.',
    );
  }
  const origenes = new Set([origenFrontend]);
  if (!produccion) origenes.add('http://localhost:3001');

  const saltos = process.env.CHECKU_TRUST_PROXY_HOPS?.trim() || '0';
  if (!/^[0-9]$/.test(saltos)) {
    throw new Error('CHECKU_TRUST_PROXY_HOPS debe ser un entero entre 0 y 9.');
  }
  app.set('trust proxy', Number(saltos));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          frameAncestors: ["'none'"],
          ...(produccion ? {} : { upgradeInsecureRequests: null }),
        },
      },
      xFrameOptions: { action: 'deny' },
      strictTransportSecurity: produccion
        ? { maxAge: 31536000, includeSubDomains: false }
        : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.enableCors({
    origin: Array.from(origenes),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Origin es controlado por el navegador. CORS solo regula la lectura de
  // respuestas; este rechazo evita ejecutar mutaciones, incluso formularios multipart.
  const comprobarOrigen: RequestHandler = (req, res, next) => {
    if (
      METODOS_SEGUROS.has(req.method) ||
      origenes.has(req.get('Origin') ?? '')
    ) {
      next();
      return;
    }

    res.status(403).json({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Origen no autorizado para modificar datos.',
    });
  };
  app.use(comprobarOrigen);
}
