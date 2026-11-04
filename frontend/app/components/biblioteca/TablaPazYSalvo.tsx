import StatusBadge, { type EstadoVisible } from "@/app/components/ui/StatusBadge";
import type { CriterioBiblioteca, EstadoBiblioteca, ResultadoBiblioteca, ResultadoCriterio } from "./tipos";
import styles from "./TablaPazYSalvo.module.css";

// Tarea 50: un solo componente para el inicio del estudiante, su preinscripción y el detalle de la
// funcionaria. Todas las vistas leen el mismo resultado guardado por el backend.

const ESTADO_CRITERIO: Record<ResultadoCriterio, EstadoVisible> = {
    cumple: "valido",
    no_cumple: "no_valido",
    no_evaluable: "por_revisar",
};
const ETIQUETA_CRITERIO: Record<ResultadoCriterio, string> = {
    cumple: "Al día",
    no_cumple: "Pendiente",
    no_evaluable: "Sin confirmar",
};
const ESTADO_GENERAL: Record<EstadoBiblioteca, [EstadoVisible, string]> = {
    cumple: ["valido", "A paz y salvo"],
    no_cumple: ["no_valido", "Con obligaciones pendientes"],
    inconsistente: ["inconsistente", "Datos que no coinciden"],
    no_encontrado: ["por_revisar", "No registrado en Biblioteca"],
    no_evaluable: ["por_revisar", "Sin confirmar"],
};
const FILAS: { clave: keyof ResultadoBiblioteca["criterios"]; tipo: string }[] = [
    { clave: "prestamos", tipo: "Préstamos activos" },
    { clave: "multas", tipo: "Multas" },
    { clave: "solicitudes", tipo: "Solicitudes pendientes" },
    { clave: "opcion_grado", tipo: "Opción de grado (informativo)" },
];

const pesos = (valor: number, moneda?: string | null) =>
    `${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
        .format(valor)
        .replace(/\s/g, "")
        .replace("COP", "")} ${moneda ?? "COP"}`;

function cantidad(clave: string, c: CriterioBiblioteca): string {
    if (clave === "opcion_grado" || c.pendientes == null) return "—";
    if (clave === "multas" && c.valor_total) return `${c.pendientes} · ${pesos(c.valor_total, c.moneda)}`;
    return String(c.pendientes);
}

export default function TablaPazYSalvo({ resultado }: { resultado: ResultadoBiblioteca }) {
    const [estado, etiqueta] = ESTADO_GENERAL[resultado.estado] ?? ESTADO_GENERAL.no_evaluable;
    const filas = FILAS.filter(({ clave }) => resultado.criterios?.[clave]);
    return (
        <div className={styles.contenedor}>
            <div className={styles.resumen}>
                <StatusBadge estado={estado} etiqueta={etiqueta} />
                <p>{resultado.mensaje}</p>
            </div>
            {filas.length > 0 && (
                <div className={styles.desplazable} role="region" aria-label="Detalle de la consulta a Biblioteca" tabIndex={0}>
                    <table className={styles.tabla}>
                        <caption className={styles.titulo}>Consulta de Paz y Salvo en Biblioteca</caption>
                        <thead>
                            <tr>
                                <th scope="col">Tipo de obligación</th>
                                <th scope="col">Detalle</th>
                                <th scope="col">Cantidad</th>
                                <th scope="col">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map(({ clave, tipo }) => {
                                const c = resultado.criterios[clave]!;
                                return (
                                    <tr key={clave}>
                                        <th scope="row">{tipo}</th>
                                        <td>{c.mensaje}</td>
                                        <td className={styles.cantidad}>{cantidad(clave, c)}</td>
                                        <td>
                                            {clave === "opcion_grado" ? (
                                                <span className={styles.informativo}>No se evalúa</span>
                                            ) : (
                                                <StatusBadge estado={ESTADO_CRITERIO[c.resultado]} etiqueta={ETIQUETA_CRITERIO[c.resultado]} />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {resultado.acciones_requeridas.length > 0 && (
                <ul className={styles.acciones}>
                    {resultado.acciones_requeridas.map((accion) => (
                        <li key={accion}>{accion}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
