"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Dialog from "@/app/components/ui/Dialog";
import Icono from "@/app/components/ui/Icono";
import PageHeader from "@/app/components/ui/PageHeader";
import StatusBadge from "@/app/components/ui/StatusBadge";
import { useSesion } from "@/app/lib/useSesion";
import {
    DESCRIPCION_CONTADOR, ESTADOS_SOLICITUD, ETIQUETA_PLURAL, ETIQUETA_SOLICITUD,
    SOLICITUDES, type EstadoSolicitud, type NivelAcademico,
} from "./datos";
import GraficoEstados from "./GraficoEstados";
import styles from "./dashboard.module.css";

type FiltroEstado = "todos" | EstadoSolicitud;
type EstadoPeriodo = "ABIERTO" | "CERRADO";
interface Periodo { id: string; nombre: string; fechaInicio: string; fechaFin: string; fechaGraduacion: string; estado: EstadoPeriodo }
const API_URL = process.env.NEXT_PUBLIC_API_URL;

function periodoVigente(periodos: Periodo[]): Periodo | null {
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    return periodos
        .filter((p) => p.estado === "ABIERTO" && p.fechaInicio <= hoy && p.fechaFin >= hoy)
        .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))[0] ?? null;
}

function elegirPeriodo(periodos: Periodo[], actual: string): string {
    if (actual && periodos.some((p) => p.id === actual)) return actual;
    return periodoVigente(periodos)?.id ?? "";
}

async function obtenerPeriodos(): Promise<Periodo[]> {
    const response = await fetch(`${API_URL}/periodos-grado`, { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "La sesión no es válida para consultar periodos." : "No fue posible consultar los periodos.");
    return response.json() as Promise<Periodo[]>;
}

export default function Dashboard() {
    const { usuario, cargando } = useSesion("funcionario");
    const [nivel, setNivel] = useState<NivelAcademico>("PREGRADO");
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
    const [fechaInicial, setFechaInicial] = useState("");
    const [fechaFinal, setFechaFinal] = useState("");
    const [rangoAplicado, setRangoAplicado] = useState<{ inicio: string; fin: string } | null>(null);
    const [periodos, setPeriodos] = useState<Periodo[]>([]);
    const [periodoId, setPeriodoId] = useState("");
    const [errorPeriodos, setErrorPeriodos] = useState("");
    const [cargandoPeriodos, setCargandoPeriodos] = useState(true);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [gestionAbierta, setGestionAbierta] = useState(false);
    const [periodoEditando, setPeriodoEditando] = useState<Periodo | null>(null);
    const [nombrePeriodo, setNombrePeriodo] = useState("");
    const [inicioPeriodo, setInicioPeriodo] = useState("");
    const [finPeriodo, setFinPeriodo] = useState("");
    const [graduacionPeriodo, setGraduacionPeriodo] = useState("");
    const [estadoPeriodo, setEstadoPeriodo] = useState<EstadoPeriodo>("ABIERTO");
    const [mensajePeriodo, setMensajePeriodo] = useState("");
    const [guardandoPeriodo, setGuardandoPeriodo] = useState(false);
    const [errorRango, setErrorRango] = useState("");
    const formPeriodoRef = useRef<HTMLFormElement>(null);

    const enfocarFormulario = useCallback(() => {
        requestAnimationFrame(() => {
            const primerCampo = formPeriodoRef.current?.querySelector<HTMLInputElement>("input");
            if (!primerCampo) return;
            primerCampo.scrollIntoView({ block: "center" });
            primerCampo.focus({ preventScroll: true });
        });
    }, []);

    const cargarPeriodos = useCallback(async () => {
        setCargandoPeriodos(true);
        setErrorPeriodos("");
        try {
            const data = await obtenerPeriodos();
            setPeriodos(data);
            setPeriodoId((actual) => elegirPeriodo(data, actual));
        } catch (error) {
            setErrorPeriodos(error instanceof Error ? error.message : "Error al consultar los periodos.");
        } finally {
            setCargandoPeriodos(false);
        }
    }, []);

    useEffect(() => {
        if (!usuario) return;
        let vigente = true;
        // Los estados se actualizan en las callbacks: el cuerpo del efecto solo lanza la consulta.
        obtenerPeriodos()
            .then((data) => {
                if (!vigente) return;
                setPeriodos(data);
                setPeriodoId((actual) => elegirPeriodo(data, actual));
            })
            .catch((error) => {
                if (vigente) setErrorPeriodos(error instanceof Error ? error.message : "Error al consultar los periodos.");
            })
            .finally(() => {
                if (vigente) setCargandoPeriodos(false);
            });
        return () => { vigente = false; };
    }, [usuario]);

    const solicitudesPeriodo = useMemo(() => {
        const periodo = periodos.find((p) => p.id === periodoId);
        if (!periodo) return [];
        // SOLICITUDES es un conjunto local de demostración: aún no hay entidad de solicitudes en la API.
        // Por ello la pertenencia al periodo se simula mediante fechas, no se presenta como asociación real.
        return SOLICITUDES.filter((s) => s.fechaRegistro.slice(0, 10) >= periodo.fechaInicio && s.fechaRegistro.slice(0, 10) <= periodo.fechaFin);
    }, [periodos, periodoId]);

    const porNivelYFecha = useMemo(() => solicitudesPeriodo.filter((s) => {
        if (s.nivel !== nivel) return false;
        if (rangoAplicado && (s.fechaRegistro.slice(0, 10) < rangoAplicado.inicio || s.fechaRegistro.slice(0, 10) > rangoAplicado.fin)) return false;
        return true;
    }), [solicitudesPeriodo, nivel, rangoAplicado]);

    const filtradas = useMemo(() => porNivelYFecha.filter((s) => filtroEstado === "todos" || s.estado === filtroEstado), [porNivelYFecha, filtroEstado]);
    const conteo = ESTADOS_SOLICITUD.map((estado) => ({ estado, cantidad: porNivelYFecha.filter((s) => s.estado === estado).length }));
    const total = porNivelYFecha.length;
    const porcentaje = (cantidad: number) => total ? Math.round((cantidad / total) * 100) : 0;

    const verEstado = (estado: EstadoSolicitud) => {
        setFiltroEstado(estado);
        requestAnimationFrame(() => {
            const titulo = document.getElementById("titulo-solicitudes");
            titulo?.focus({ preventScroll: true });
            titulo?.scrollIntoView({ block: "start" });
        });
    };

    const aplicarRango = () => {
        if (fechaInicial && fechaFinal && fechaInicial > fechaFinal) {
            setErrorRango("La fecha inicial no puede ser posterior a la fecha final.");
            return;
        }
        if (Boolean(fechaInicial) !== Boolean(fechaFinal)) {
            setErrorRango("Selecciona ambas fechas para aplicar el rango.");
            return;
        }
        setErrorRango("");
        setRangoAplicado(fechaInicial && fechaFinal ? { inicio: fechaInicial, fin: fechaFinal } : null);
    };

    const limpiarRango = () => {
        setFechaInicial(""); setFechaFinal(""); setRangoAplicado(null); setErrorRango("");
    };

    const limpiarFormulario = useCallback(() => {
        setPeriodoEditando(null);
        setNombrePeriodo(""); setInicioPeriodo(""); setFinPeriodo(""); setGraduacionPeriodo(""); setEstadoPeriodo("ABIERTO"); setMensajePeriodo("");
    }, []);

    const cerrarGestion = () => {
        setGestionAbierta(false);
        limpiarFormulario();
    };

    const guardarPeriodo = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMensajePeriodo("");
        if (inicioPeriodo > finPeriodo) { setMensajePeriodo("La fecha inicial no puede ser posterior a la fecha final."); return; }
        setGuardandoPeriodo(true);
        try {
            const response = await fetch(`${API_URL}/periodos-grado${periodoEditando ? `/${periodoEditando.id}` : ""}`, {
                method: periodoEditando ? "PATCH" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: nombrePeriodo, fechaInicio: inicioPeriodo, fechaFin: finPeriodo, fechaGraduacion: graduacionPeriodo, estado: estadoPeriodo }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.message ?? "No fue posible guardar el periodo.");
            setMensajePeriodo("Periodo guardado correctamente.");
            setNombrePeriodo(""); setInicioPeriodo(""); setFinPeriodo(""); setGraduacionPeriodo(""); setEstadoPeriodo("ABIERTO"); setPeriodoEditando(null);
            await cargarPeriodos();
        } catch (error) {
            setMensajePeriodo(error instanceof Error ? error.message : "Ocurrió un error al guardar.");
        } finally { setGuardandoPeriodo(false); }
    };

    const abrirGestion = () => {
        setGestionAbierta(true);
        enfocarFormulario();
    };

    const editarPeriodo = (periodo: Periodo) => {
        setPeriodoEditando(periodo); setNombrePeriodo(periodo.nombre);
        setInicioPeriodo(periodo.fechaInicio); setFinPeriodo(periodo.fechaFin); setGraduacionPeriodo(periodo.fechaGraduacion); setEstadoPeriodo(periodo.estado); setMensajePeriodo("");
        enfocarFormulario();
    };

    if (cargando || !usuario) {
        return <main id="contenido" tabIndex={-1} className={styles.cargando} aria-busy="true"><p>Verificando sesión...</p></main>;
    }

    return (
        <>
            <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} />
            <main id="contenido" tabIndex={-1} className={styles.pagina}>
                <PageHeader titulo="Dashboard de solicitudes de grado" descripcion="Resumen y seguimiento de las solicitudes de grado." />

                <Card
                    titulo="Filtros de búsqueda"
                    className={styles.panelFiltros}
                    cabeceraSinMargen={!mostrarFiltros}
                    acciones={
                        <div className={styles.accionesPanel}>
                            <Button
                                variante="secundario"
                                className={styles.botonIcono}
                                onClick={() => setMostrarFiltros((visible) => !visible)}
                                aria-expanded={mostrarFiltros}
                                aria-controls="panel-filtros"
                                aria-label={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
                                title={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
                            >
                                <Icono nombre="filtro" tamano={20} />
                            </Button>
                            <Button variante="secundario" onClick={abrirGestion} aria-haspopup="dialog">
                                Gestionar periodos
                            </Button>
                        </div>
                    }
                >
                    <div id="panel-filtros" className={styles.contenidoFiltros} hidden={!mostrarFiltros}>
                        <p className={styles.descripcionFiltros}>Consulta las solicitudes por periodo, nivel, estado y rango de fechas.</p>

                        <div className={styles.rejillaFiltros}>
                            <fieldset className={styles.grupoFiltro}>
                                <legend id="titulo-periodo">Periodo de grado</legend>
                                <select
                                    id="periodo-grado"
                                    className={styles.control}
                                    aria-labelledby="titulo-periodo"
                                    value={periodoId}
                                    onChange={(e) => setPeriodoId(e.target.value)}
                                    disabled={cargandoPeriodos || periodos.length === 0}
                                >
                                    <option value="">{cargandoPeriodos ? "Cargando periodos..." : "Selecciona un periodo"}</option>
                                    {periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.estado} ({p.fechaInicio} – {p.fechaFin})</option>)}
                                </select>
                                {errorPeriodos && <p className={styles.error} role="alert">{errorPeriodos}</p>}
                                {!cargandoPeriodos && !errorPeriodos && periodos.length === 0 && <p className={styles.textoSecundario}>No hay periodos registrados. Crea uno para comenzar.</p>}
                                {!cargandoPeriodos && periodos.length > 0 && !periodos.some((p) => p.estado === "ABIERTO") && <p className={styles.textoSecundario}>No hay periodos abiertos. Los periodos cerrados se pueden consultar, pero no deben recibir nuevas solicitudes.</p>}
                            </fieldset>

                            <fieldset className={styles.grupoFiltro}>
                                <legend id="titulo-nivel">Nivel académico</legend>
                                <select
                                    id="nivel-academico"
                                    className={styles.control}
                                    aria-labelledby="titulo-nivel"
                                    value={nivel}
                                    onChange={(e) => setNivel(e.target.value as NivelAcademico)}
                                >
                                    <option value="PREGRADO">Pregrado</option><option value="POSGRADO">Posgrado</option>
                                </select>
                            </fieldset>

                            <fieldset className={styles.grupoFiltro}>
                                <legend>Rango de fechas</legend>
                                <div className={styles.camposFecha}>
                                    <label className={styles.campo}>Fecha inicial<input className={styles.control} type="date" value={fechaInicial} onChange={(e) => setFechaInicial(e.target.value)} /></label>
                                    <label className={styles.campo}>Fecha final<input className={styles.control} type="date" min={fechaInicial || undefined} value={fechaFinal} onChange={(e) => setFechaFinal(e.target.value)} /></label>
                                </div>
                                <div className={styles.accionesFiltro}>
                                    <Button onClick={aplicarRango}>Aplicar fechas</Button>
                                    <Button variante="secundario" onClick={limpiarRango}>Limpiar fechas</Button>
                                </div>
                                {errorRango && <p className={styles.error} role="alert">{errorRango}</p>}
                            </fieldset>

                            <fieldset className={styles.grupoFiltro}>
                                <legend>Estado de la solicitud</legend>
                                <div className={styles.filtros}>
                                    {(["todos", ...ESTADOS_SOLICITUD] as FiltroEstado[]).map((valor) => <button key={valor} type="button" className={styles.filtro} aria-pressed={filtroEstado === valor} onClick={() => setFiltroEstado(valor)}>{valor === "todos" ? "Todas" : ETIQUETA_PLURAL[valor]}</button>)}
                                </div>
                            </fieldset>
                        </div>
                    </div>
                </Card>

                <Dialog
                    abierto={gestionAbierta}
                    alCerrar={cerrarGestion}
                    titulo="Gestión de periodos de grado"
                    descripcion="Crea un periodo nuevo o edita uno existente. Las fechas definen la ventana de inscripción."
                    etiqueta="Periodos"
                >
                    <div className={styles.gestionPeriodos}>
                        <section className={styles.bloqueGestion} aria-labelledby="titulo-form-periodo">
                            <div className={styles.cabeceraBloque}>
                                <h3 id="titulo-form-periodo">{periodoEditando ? "Editar periodo" : "Nuevo periodo"}</h3>
                            </div>
                            <form ref={formPeriodoRef} className={styles.formPeriodo} onSubmit={guardarPeriodo}>
                                <label className={`${styles.campo} ${styles.campoAncho}`}>Nombre del periodo<input className={styles.control} required maxLength={120} value={nombrePeriodo} onChange={(e) => setNombrePeriodo(e.target.value)} placeholder="Ej. Grados octubre 2026" /></label>
                                <label className={styles.campo}>Fecha de inicio<input className={styles.control} required type="date" value={inicioPeriodo} onChange={(e) => setInicioPeriodo(e.target.value)} /></label>
                                <label className={styles.campo}>Fecha de finalización<input className={styles.control} required type="date" min={inicioPeriodo || undefined} value={finPeriodo} onChange={(e) => setFinPeriodo(e.target.value)} /></label>
                                <label className={styles.campo}>Fecha de graduación<input className={styles.control} required type="date" value={graduacionPeriodo} onChange={(e) => setGraduacionPeriodo(e.target.value)} /></label>
                                <label className={`${styles.campo} ${styles.campoAncho}`}>Estado del periodo<select className={styles.control} required value={estadoPeriodo} onChange={(e) => setEstadoPeriodo(e.target.value as EstadoPeriodo)}><option value="ABIERTO">ABIERTO — recibe solicitudes</option><option value="CERRADO">CERRADO — no recibe solicitudes</option></select></label>
                                <div className={`${styles.accionesFormulario} ${styles.campoAncho}`}>
                                    <Button type="submit" disabled={guardandoPeriodo}>{guardandoPeriodo ? "Guardando..." : periodoEditando ? "Guardar cambios" : "Registrar periodo"}</Button>
                                    {periodoEditando && <Button type="button" variante="secundario" onClick={limpiarFormulario}>Cancelar edición</Button>}
                                </div>
                                {mensajePeriodo && <p role="status" className={`${styles.mensajePeriodo} ${styles.campoAncho}`}>{mensajePeriodo}</p>}
                            </form>
                        </section>

                        <section className={styles.bloqueGestion} aria-labelledby="titulo-lista-periodos">
                            <div className={styles.cabeceraBloque}>
                                <h3 id="titulo-lista-periodos">Periodos registrados</h3>
                                <span className={styles.conteo}>{periodos.length === 1 ? "1 periodo" : `${periodos.length} periodos`}</span>
                            </div>
                            {periodos.length === 0
                                ? <p className={styles.textoSinPeriodos}>Aún no hay periodos registrados. Crea el primero con el formulario.</p>
                                : <ul className={styles.listaPeriodos} aria-label="Periodos de grado registrados">{periodos.map((p) => <li key={p.id}><span><strong>{p.nombre} · {p.estado}</strong><small>Recepción: {p.fechaInicio} – {p.fechaFin} · Graduación: {p.fechaGraduacion}</small></span><Button variante="secundario" onClick={() => editarPeriodo(p)} aria-label={`Editar ${p.nombre}`}>Editar</Button></li>)}</ul>}
                        </section>
                    </div>
                </Dialog>

                <section aria-labelledby="titulo-resumen" className={styles.seccion}>
                    <h2 id="titulo-resumen" className="solo-lector">Resumen por estado</h2>
                    <p id="ayuda-contadores" className="solo-lector">Al pulsar un contador se filtra la lista de solicitudes sin cambiar el nivel, periodo o rango de fechas.</p>
                    <ul className={styles.contadores}>{conteo.map(({ estado, cantidad }) => <li key={estado}>
                        <button type="button" className={styles.contador} data-estado={estado} aria-describedby="ayuda-contadores" onClick={() => verEstado(estado)}>
                            <span className={styles.contadorCabecera}><span className={styles.contadorTitulo}>{ETIQUETA_PLURAL[estado]}</span><span className={styles.marca} aria-hidden="true" /></span>
                            <span className={styles.contadorValor}><span className={styles.cifra}>{cantidad}</span><span className={styles.porcentaje}>{porcentaje(cantidad)} %</span></span>
                            <span className={styles.contadorDescripcion}>{DESCRIPCION_CONTADOR[estado]}</span>
                        </button>
                    </li>)}</ul>
                </section>

                <div className={styles.graficos}>
                    <GraficoEstados tipo="barras" titulo="Distribución de solicitudes" descripcion="Cantidad de solicitudes por estado para los filtros seleccionados." datos={conteo} />
                    <GraficoEstados tipo="dona" titulo="Distribución porcentual" descripcion="Porcentaje de solicitudes según su estado para los filtros seleccionados." datos={conteo} />
                </div>

                <Card id="solicitudes" tituloId="titulo-solicitudes" titulo="Solicitudes de grado" acciones={<p aria-live="polite" className={styles.conteo}>{filtradas.length === 1 ? "1 solicitud" : `${filtradas.length} solicitudes`}</p>}>
                    <p className={styles.textoSecundario}>Solicitudes registradas para los filtros seleccionados.</p>
                    {!periodoId ? <div className={styles.vacio}><h3>Selecciona un periodo</h3><p>Para consultar solicitudes, selecciona un periodo de grado registrado.</p></div>
                    : filtradas.length === 0 ? <div className={styles.vacio}><h3>No hay solicitudes</h3><p>No hay solicitudes para la combinación de periodo, nivel, estado y fechas seleccionada.</p></div>
                    : <>
                        <table className={styles.tabla}>
                            <caption className="solo-lector">Solicitudes de grado. Nivel: {nivel === "PREGRADO" ? "Pregrado" : "Posgrado"}. Estado: {filtroEstado === "todos" ? "Todas" : ETIQUETA_PLURAL[filtroEstado]}.</caption>
                            <thead><tr><th scope="col">No. solicitud</th><th scope="col">Fecha y hora</th><th scope="col">Estudiante</th><th scope="col">Nivel</th><th scope="col">Estado</th><th scope="col"><span className="solo-lector">Acción</span></th></tr></thead>
                            <tbody>{filtradas.map((s) => <tr key={s.numero}><td className={styles.numero}>{s.numero}</td><td className={styles.fecha}>{s.fecha}</td><td>{s.estudiante}</td><td>{s.nivel === "PREGRADO" ? "Pregrado" : "Posgrado"}</td><td><StatusBadge estado={s.estado} etiqueta={ETIQUETA_SOLICITUD[s.estado]} /></td><td className={styles.accion}><Button href={`/funcionario/detalle_preinscripcion/${s.numero}`} variante="secundario" aria-label={`Ver solicitud ${s.numero}`}>Ver solicitud</Button></td></tr>)}</tbody>
                        </table>
                        <ul aria-label="Solicitudes de grado" className={styles.tarjetas}>{filtradas.map((s) => <li key={s.numero} className={styles.tarjeta}>
                            <div className={styles.tarjetaCabecera}><span className={styles.numero}>{s.numero}</span><StatusBadge estado={s.estado} etiqueta={ETIQUETA_SOLICITUD[s.estado]} /></div>
                            <p className={styles.tarjetaEstudiante}>{s.estudiante}</p><p>Nivel: {s.nivel === "PREGRADO" ? "Pregrado" : "Posgrado"}</p><p className={styles.fecha}>{s.fecha}</p>
                            <Button href={`/funcionario/detalle_preinscripcion/${s.numero}`} variante="secundario" aria-label={`Ver solicitud ${s.numero}`} className={styles.tarjetaAccion}>Ver solicitud</Button>
                        </li>)}</ul>
                    </>}
                </Card>
            </main>
        </>
    );
}
