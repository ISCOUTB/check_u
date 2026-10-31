'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Navbar from '@/app/components/navbar/Navbar';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import PageHeader from '@/app/components/ui/PageHeader';
import { useEstadoNavegacion } from '@/app/lib/useEstadoNavegacion';
import { useSesion } from '@/app/lib/useSesion';
import {
  DOCUMENTOS_REQUERIDOS,
  type NivelAcademico,
  type RequisitoDocumento,
} from '../documentos-requeridos';
import styles from './bienvenida.module.css';

interface BloqueNivelProps {
  nivel: NivelAcademico;
  titulo: string;
  textoBoton: string;
  documentos: RequisitoDocumento[];
}

function BloqueNivel({
  nivel,
  titulo,
  textoBoton,
  documentos,
}: BloqueNivelProps) {
  const destino = `/estudiante/iniciar_preinscripcion?nivel=${nivel}`;

  return (
    <Card titulo={titulo} nivelTitulo={2} className={styles.tarjetaNivel}>
      <div className={styles.cuerpoNivel}>
        <div className={styles.accionBoton}>
          <Button href={destino} className={styles.botonNivel}>
            {textoBoton}
          </Button>
        </div>
        <p className={styles.textoIndicacion}>
          Deberás subir los siguientes documentos en formato PDF.
        </p>
        <ol className={styles.listaDocumentos}>
          {documentos.map((doc) => (
            <li key={doc.tipo} className={styles.itemDocumento}>
              <span className={styles.nombreDocumento}>{doc.nombre}</span>
              {doc.nota && (
                <span className={styles.notaDocumento}> {doc.nota}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

export default function Bienvenida() {
  const { usuario, cargando: cargandoSesion } = useSesion('estudiante');
  const router = useRouter();
  const pathname = usePathname();

  const {
    cargando: cargandoEstado,
    error: errorEstado,
    data: estadoNav,
    reintentar: reintentarEstado,
  } = useEstadoNavegacion(Boolean(usuario));

  useEffect(() => {
    if (!estadoNav?.destino) return;
    if (estadoNav.destino !== pathname) {
      router.replace(estadoNav.destino);
    }
  }, [estadoNav, pathname, router]);

  if (cargandoSesion || !usuario || (cargandoEstado && !errorEstado)) {
    return (
      <main
        id="contenido"
        tabIndex={-1}
        className={styles.cargando}
        aria-busy="true"
      >
        <span className={styles.spinner} aria-hidden="true" />
        <p>Verificando sesión...</p>
      </main>
    );
  }

  if (errorEstado) {
    return (
      <main id="contenido" tabIndex={-1} className={styles.pagina}>
        <p role="alert">{errorEstado}</p>
        <Button variante="secundario" onClick={() => reintentarEstado()}>
          Reintentar
        </Button>
      </main>
    );
  }

  if (estadoNav && estadoNav.destino !== pathname) {
    return (
      <main
        id="contenido"
        tabIndex={-1}
        className={styles.cargando}
        aria-busy="true"
      >
        <span className={styles.spinner} aria-hidden="true" />
        <p>Redirigiendo...</p>
      </main>
    );
  }

  // TODO: Hoy /auth/me no devuelve el campo nivel en el usuario de sesión.
  // Si usuario.nivel está definido, se muestra únicamente el bloque de ese nivel para guiar al estudiante.
  // Si no está definido, se muestran ambos bloques (Pregrado y Posgrado).
  // REGLA: El backend es la autoridad de validación y debe impedir que un estudiante inicie en un nivel no permitido.
  const nivelUsuario = usuario.nivel;
  const mostrarPregrado = !nivelUsuario || nivelUsuario === 'PREGRADO';
  const mostrarPosgrado = !nivelUsuario || nivelUsuario === 'POSGRADO';
  const muestraAmbos = mostrarPregrado && mostrarPosgrado;

  return (
    <>
      <Navbar
        tipoUsuario={usuario.role}
        nombreUsuario={usuario.name}
        nivel={usuario.nivel}
      />
      <main id="contenido" tabIndex={-1} className={styles.pagina}>
        <div className={styles.seccionBienvenida}>
          <PageHeader
            etiqueta="PREINSCRIPCIÓN DE GRADO"
            titulo={`¡Hola, ${usuario.name}!`}
            descripcion="Desde aquí puedes iniciar la preinscripción de tu solicitud de grado. Selecciona tu nivel académico y conoce los documentos necesarios para completar el proceso."
          />
        </div>

        <div
          className={muestraAmbos ? styles.bloques : styles.bloquesUnico}
          data-testid="bloques-nivel"
        >
          {mostrarPregrado && (
            <BloqueNivel
              nivel="PREGRADO"
              titulo="Pregrado"
              textoBoton="Iniciar preinscripción para pregrado"
              documentos={DOCUMENTOS_REQUERIDOS.PREGRADO}
            />
          )}
          {mostrarPosgrado && (
            <BloqueNivel
              nivel="POSGRADO"
              titulo="Posgrado"
              textoBoton="Iniciar preinscripción para posgrado"
              documentos={DOCUMENTOS_REQUERIDOS.POSGRADO}
            />
          )}
        </div>
      </main>
    </>
  );
}
