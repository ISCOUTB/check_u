"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
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
    const [mostrarGestion, setMostrarGestion] = useState(false);
    const [periodoEditando, setPeriodoEditando] = useState<Periodo | null>(null);
    const [nombrePeriodo, setNombrePeriodo] = useState("");
    const [inicioPeriodo, setInicioPeriodo] = useState("");
    const [finPeriodo, setFinPeriodo] = useState("");
    const [graduacionPeriodo, setGraduacionPeriodo] = useState("");
    const [estadoPeriodo, setEstadoPeriodo] = useState<EstadoPeriodo>("ABIERTO");
    const [mensajePeriodo, setMensajePeriodo] = useState("");
    const [guardandoPeriodo, setGuardandoPeriodo] = useState(false);
    const [errorRango, setErrorRango] = useState("");

    const cargarPeriodos = useCallback(async () => {
        setCargandoPeriodos(true);
        setErrorPeriodos("");
        try {
            const response = await fetch(`${API_URL}/periodos-grado`, { credentials: "include", cache: "no-store" });
            if (!response.ok) throw new Error(response.status === 401 ? "La sesión no es válida para consultar periodos." : "No fue posible consultar los periodos.");
            const data = await response.json() as Periodo[];
            setPeriodos(data);
            setPeriodoId((actual) => {
                if (actual && data.some((p) => p.id === actual)) return actual;
                return periodoVigente(data)?.id ?? "";
            });
        } catch (error) {
            setErrorPeriodos(error instanceof Error ? error.message : "Error al consultar los periodos.");
        } finally {
            setCargandoPeriodos(false);
        }
    }, []);

    useEffect(() => { if (usuario) void cargarPeriodos(); }, [usuario, cargarPeriodos]);

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

    const editarPeriodo = (periodo: Periodo) => {
        setPeriodoEditando(periodo); setNombrePeriodo(periodo.nombre);
        setInicioPeriodo(periodo.fechaInicio); setFinPeriodo(periodo.fechaFin); setGraduacionPeriodo(periodo.fechaGraduacion); setEstadoPeriodo(periodo.estado); setMensajePeriodo("");
    };

    if (cargando || !usuario) {
        return <main id="contenido" tabIndex={-1} className={styles.cargando} aria-busy="true"><p>Verificando sesión...</p></main>;
    }

    return (
        <>
            <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} />
            <main id="contenido" tabIndex={-1} className={styles.pagina}>
                <PageHeader titulo="Dashboard de solicitudes de grado" descripcion="Resumen y seguimiento de las solicitudes de grado." />

                <section className={styles.seccion} aria-labelledby="titulo-periodo">
                    <div className={styles.cabeceraPeriodo}>
                        <label htmlFor="periodo-grado" id="titulo-periodo">Periodo de grado</label>
                        <Button variante="secundario" onClick={() => setMostrarGestion((v) => !v)}>
                            {mostrarGestion ? "Cerrar gestión" : "Gestionar periodos"}
                        </Button>
                    </div>
                    <select id="periodo-grado" className={styles.control} value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} disabled={cargandoPeriodos || periodos.length === 0}>
                        <option value="">{cargandoPeriodos ? "Cargando periodos..." : "Selecciona un periodo"}</option>
                        {periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.estado} ({p.fechaInicio} – {p.fechaFin})</option>)}
                    </select>
                    {errorPeriodos && <p className={styles.error} role="alert">{errorPeriodos}</p>}
                    {!cargandoPeriodos && !errorPeriodos && periodos.length === 0 && <p className={styles.textoSecundario}>No hay periodos registrados. Crea uno para comenzar.</p>}
                    {!cargandoPeriodos && periodos.length > 0 && !periodos.some((p) => p.estado === "ABIERTO") && <p className={styles.textoSecundario}>No hay periodos abiertos. Los periodos cerrados se pueden consultar, pero no deben recibir nuevas solicitudes.</p>}
                </section>

                {mostrarGestion && <Card titulo="Gestión de periodos de grado">
                    <form className={styles.formPeriodo} onSubmit={guardarPeriodo}>
                        <label>Nombre del periodo<input required maxLength={120} value={nombrePeriodo} onChange={(e) => setNombrePeriodo(e.target.value)} placeholder="Ej. Grados octubre 2026" /></label>
                        <label>Fecha de inicio<input required type="date" value={inicioPeriodo} onChange={(e) => setInicioPeriodo(e.target.value)} /></label>
                        <label>Fecha de finalización<input required type="date" min={inicioPeriodo || undefined} value={finPeriodo} onChange={(e) => setFinPeriodo(e.target.value)} /></label>
                        <label>Fecha de graduación<input required type="date" value={graduacionPeriodo} onChange={(e) => setGraduacionPeriodo(e.target.value)} /></label>
                        <label>Estado del periodo<select required className={styles.control} value={estadoPeriodo} onChange={(e) => setEstadoPeriodo(e.target.value as EstadoPeriodo)}><option value="ABIERTO">ABIERTO — recibe solicitudes</option><option value="CERRADO">CERRADO — no recibe solicitudes</option></select></label>
                        <div className={styles.accionesFormulario}>
                            <Button type="submit" disabled={guardandoPeriodo}>{guardandoPeriodo ? "Guardando..." : periodoEditando ? "Guardar cambios" : "Registrar periodo"}</Button>
                            {periodoEditando && <Button type="button" variante="secundario" onClick={() => { setPeriodoEditando(null); setNombrePeriodo(""); setInicioPeriodo(""); setFinPeriodo(""); setGraduacionPeriodo(""); setEstadoPeriodo("ABIERTO"); }}>Cancelar edición</Button>}
                        </div>
                        {mensajePeriodo && <p role="status" className={styles.textoSecundario}>{mensajePeriodo}</p>}
                    </form>
                    <ul className={styles.listaPeriodos}>{periodos.map((p) => <li key={p.id}><span><strong>{p.nombre} · {p.estado}</strong><small>Recepción: {p.fechaInicio} – {p.fechaFin} · Graduación: {p.fechaGraduacion}</small></span><Button variante="secundario" onClick={() => editarPeriodo(p)}>Editar</Button></li>)}</ul>
                </Card>}

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

                <Card id="solicitudes" tituloId="titulo-solicitudes" titulo="Solicitudes de grado" className={styles.listado} acciones={<p aria-live="polite" className={styles.conteo}>{filtradas.length} solicitudes</p>}>
                    <p className={styles.textoSecundario}>Consulta las solicitudes registradas en el sistema.</p>
                    <div className={styles.grupoFiltros}>
                        <label htmlFor="nivel-academico">Nivel académico</label>
                        <select id="nivel-academico" className={styles.control} value={nivel} onChange={(e) => setNivel(e.target.value as NivelAcademico)}>
                            <option value="PREGRADO">Pregrado</option><option value="POSGRADO">Posgrado</option>
                        </select>
                        <div role="group" aria-label="Filtrar por estado" className={styles.filtros}>
                            {(["todos", ...ESTADOS_SOLICITUD] as FiltroEstado[]).map((valor) => <button key={valor} type="button" className={styles.filtro} aria-pressed={filtroEstado === valor} onClick={() => setFiltroEstado(valor)}>{valor === "todos" ? "Todas" : ETIQUETA_PLURAL[valor]}</button>)}
                        </div>
                    </div>
                    <div className={styles.filtroFechas}>
                        <label>Fecha inicial<input type="date" value={fechaInicial} onChange={(e) => setFechaInicial(e.target.value)} /></label>
                        <label>Fecha final<input type="date" min={fechaInicial || undefined} value={fechaFinal} onChange={(e) => setFechaFinal(e.target.value)} /></label>
                        <Button onClick={aplicarRango}>Aplicar fechas</Button>
                        <Button variante="secundario" onClick={limpiarRango}>Limpiar fechas</Button>
                    </div>
                    {errorRango && <p className={styles.error} role="alert">{errorRango}</p>}
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
