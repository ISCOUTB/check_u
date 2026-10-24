"""Analizador de cumplimiento de la malla curricular a partir de la Evaluación de Grado."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .extractor import DatosDocumentoBanner, ExtractorEvaluacionBanner
from .modelos import PeriodoEvaluacion, ResultadoCumplimiento, ResultadoMallaCurricular


class AnalizadorMallaCurricular:
    """Aplica las reglas de negocio de la Tarea 27 sobre los datos extraídos."""

    def __init__(self, extractor: ExtractorEvaluacionBanner | None = None) -> None:
        self.extractor = extractor or ExtractorEvaluacionBanner()

    def analizar(self, origen: bytes | str | Path) -> ResultadoMallaCurricular:
        """Procesa un archivo PDF o contenido en bytes y retorna el resultado de cumplimiento."""
        datos = self.extractor.extraer_desde_bytes_o_archivo(origen)
        return self.evaluar_datos(datos)

    def evaluar_datos(self, datos: DatosDocumentoBanner) -> ResultadoMallaCurricular:
        # Caso de error estructural (no es PDF, protegido, vacío, sin texto o no es Banner)
        if datos.error or not datos.es_banner:
            motivo_error = (
                datos.error
                or "El documento analizado no corresponde a una Evaluación de Grado expedida por Banner o la información es ilegible o incompleta."
            )
            return ResultadoMallaCurricular(
                type_document="academic_evaluation",
                full_name_student=datos.full_name_student,
                code_student=datos.code_student,
                program=datos.program,
                general_result="no_cumple",
                motivo=motivo_error,
                max_credits=datos.max_credits,
                credits_approved=datos.credits_approved,
                periods=[],
            )

        # Si no se identificaron periodos evaluados
        if not datos.periodos:
            return ResultadoMallaCurricular(
                type_document="academic_evaluation",
                full_name_student=datos.full_name_student,
                code_student=datos.code_student,
                program=datos.program,
                general_result="no_cumple",
                motivo="No fue posible identificar periodos o niveles académicos en la evaluación de Banner para verificar el cumplimiento.",
                max_credits=datos.max_credits,
                credits_approved=datos.credits_approved,
                periods=[],
            )

        # Evaluar cada periodo individual
        periodos_evaluados: list[PeriodoEvaluacion] = []
        for p_ext in datos.periodos:
            periodos_evaluados.append(self._evaluar_periodo(p_ext))

        # Recolectar periodos con incumplimiento
        periodos_incumplidos: list[tuple[str, int | None]] = []
        periodos_norm_inc = [
            p_eval.period for p_eval in periodos_evaluados if p_eval.result == "no_cumple" and p_eval.period
        ]
        hay_duplicados = len(periodos_norm_inc) != len(set(periodos_norm_inc))

        for p_ext, p_eval in zip(datos.periodos, periodos_evaluados):
            if p_eval.result == "no_cumple":
                if hay_duplicados and p_ext.periodo_crudo and p_eval.period:
                    nombre_periodo = f"{p_ext.periodo_crudo} ({p_eval.period})"
                else:
                    nombre_periodo = p_eval.period or p_ext.periodo_crudo or "no especificado"
                periodos_incumplidos.append((nombre_periodo, p_eval.faltantes))

        # Determinar resultado general
        todos_cumplen = len(periodos_incumplidos) == 0
        general_result: ResultadoCumplimiento = "cumple" if todos_cumplen else "no_cumple"

        # Redactar el motivo
        motivo = self._generar_motivo(todos_cumplen, periodos_incumplidos)

        return ResultadoMallaCurricular(
            type_document="academic_evaluation",
            full_name_student=datos.full_name_student,
            code_student=datos.code_student,
            program=datos.program,
            general_result=general_result,
            motivo=motivo,
            max_credits=datos.max_credits,
            credits_approved=datos.credits_approved,
            periods=periodos_evaluados,
        )

    def _evaluar_periodo(self, p_ext) -> PeriodoEvaluacion:
        c_tot = p_ext.credits_total
        c_apr = p_ext.credits_approved
        faltantes = p_ext.faltantes_declarados

        # Fórmula obligatoria: faltantes = credits_total - credits_approved
        if faltantes is None and c_tot is not None and c_apr is not None:
            faltantes = max(0, c_tot - c_apr)

        # Regla de resultado:
        # Cumple si todos los niveles/periodos tienen Cumple: Sí y no presentan créditos pendientes
        if faltantes is not None and faltantes > 0:
            res: ResultadoCumplimiento = "no_cumple"
        elif p_ext.cumple_declarado is False:
            res = "no_cumple"
        elif p_ext.cumple_declarado is True:
            res = "cumple"
        elif faltantes == 0 and c_apr is not None and c_tot is not None:
            res = "cumple"
        else:
            # Si no hay certeza o faltan datos indispensables
            res = "no_cumple"

        return PeriodoEvaluacion(
            period=p_ext.periodo_normalizado,
            credits_approved=c_apr,
            credits_total=c_tot,
            faltantes=faltantes,
            result=res,
        )

    def _generar_motivo(
        self,
        todos_cumplen: bool,
        periodos_incumplidos: list[tuple[str, int | None]],
    ) -> str:
        if todos_cumplen:
            return (
                "El estudiante cumple con todos los niveles o periodos académicos evaluados y no presenta "
                "créditos pendientes de aprobación según la evaluación de Banner."
            )

        # Caso no cumple: detallar los periodos y créditos faltantes
        con_faltantes = [(p, f) for p, f in periodos_incumplidos if f is not None and f > 0]

        if con_faltantes:
            if len(con_faltantes) == 1:
                p_nombre, f_cant = con_faltantes[0]
                palabra_credito = "crédito pendiente" if f_cant == 1 else "créditos pendientes"
                return (
                    f"En el periodo {p_nombre}, el estudiante tiene {f_cant} {palabra_credito} de aprobación, "
                    f"por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."
                )
            elif len(con_faltantes) == 2:
                p1, f1 = con_faltantes[0]
                p2, f2 = con_faltantes[1]
                return (
                    f"En los periodos {p1} y {p2}, el estudiante tiene {f1} y {f2} créditos pendientes de aprobación, "
                    f"respectivamente, por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."
                )
            else:
                nombres = ", ".join(p for p, _ in con_faltantes[:-1]) + f" y {con_faltantes[-1][0]}"
                cantidades = ", ".join(str(f) for _, f in con_faltantes[:-1]) + f" y {con_faltantes[-1][1]}"
                return (
                    f"En los periodos {nombres}, el estudiante tiene {cantidades} créditos pendientes de aprobación, "
                    f"respectivamente, por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."
                )

        # Si no hay créditos faltantes numéricos explícitos pero el periodo falló (ej. requisito pendiente sin créditos)
        nombres_periodos = [p for p, _ in periodos_incumplidos]
        if len(nombres_periodos) == 1:
            return (
                f"En el periodo {nombres_periodos[0]}, el estudiante presenta requisitos pendientes de aprobación "
                f"según la evaluación de Banner, por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."
            )
        else:
            nombres = ", ".join(nombres_periodos[:-1]) + f" y {nombres_periodos[-1]}"
            return (
                f"En los periodos {nombres}, el estudiante presenta requisitos pendientes de aprobación "
                f"según la evaluación de Banner, por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."
            )
