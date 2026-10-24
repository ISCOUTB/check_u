"""Extractor de información académica desde el PDF de Evaluación de Grado de Banner."""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pymupdf

DANADO = "El archivo está vacío, no es un PDF válido o está dañado."
PROTEGIDO = "El archivo PDF está protegido con contraseña."
SIN_TEXTO = "El archivo PDF no contiene texto digital legible (posible documento escaneado)."
NO_ES_BANNER = "El documento analizado no corresponde a una Evaluación de Grado expedida por Banner."

# Palabras clave distintivas de Banner / Evaluación de Grado
TERMINOS_BANNER = (
    "EVALUACION DE GRADO",
    "EVALUACIÓN DE GRADO",
    "AUDITORIA DE GRADO",
    "AUDITORÍA DE GRADO",
    "DEGREE EVALUATION",
    "BANNER",
    "CAPP",
    "EVALUACION PROGRAMA",
    "EVALUACIÓN PROGRAMA",
    "REPORTE DE AVANCE ACADEMICO",
    "REPORTE DE AVANCE ACADÉMICO",
    "REQUERIMIENTOS AREA",
    "REQUERIMIENTOS ÁREA",
    "REQUERIMIENTOS DE DETALLE",
    "TOTAL REQUERIDO",
)

MAPA_PROGRAMAS_UTB = {
    "I. SIS Y COM": "Ingeniería de Sistemas y Computación",
    "I.SIS Y COM": "Ingeniería de Sistemas y Computación",
    "I. SIS": "Ingeniería de Sistemas",
    "I. IND": "Ingeniería Industrial",
    "I. MEC": "Ingeniería Mecánica",
    "I. ELEC": "Ingeniería Electrónica",
    "I. ELE": "Ingeniería Eléctrica",
    "I. CIV": "Ingeniería Civil",
    "I. AMB": "Ingeniería Ambiental",
    "I. QUIM": "Ingeniería Química",
}

ORDINALES_SEMESTRES = {
    "PRIMER": 1,
    "SEGUNDO": 2,
    "TERCER": 3,
    "CUARTO": 4,
    "QUINTO": 5,
    "SEXTO": 6,
    "SEPTIMO": 7,
    "SÉPTIMO": 7,
    "OCTAVO": 8,
    "NOVENO": 9,
    "DECIMO": 10,
    "DÉCIMO": 10,
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
    "VII": 7,
    "VIII": 8,
    "IX": 9,
    "X": 10,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
}

# Regex para datos de encabezado
RE_NOMBRE = [
    re.compile(r"(?:Estudiante|Alumno|Nombre(?:\s+del\s+Estudiante)?)\s*[:\t ]+\s*(?:(?:T\d{5,10}|\d{6,12})\s*[-–—:]\s*)?([^\n\r]+)", re.IGNORECASE),
    re.compile(r"Nombre\s*:\s*([^\n\r]+)", re.IGNORECASE),
]

RE_CODIGO = [
    re.compile(r"(?:Código|Codigo|ID)(?:\s+Estudiantil|\s+del\s+Alumno|\s+del\s+Estudiante)?\s*[:\t ]+\s*([A-Za-z0-9_-]+)", re.IGNORECASE),
    re.compile(r"\b(T\d{8})\b", re.IGNORECASE),
    re.compile(r"\bID\s*[:\t ]+\s*([A-Za-z0-9_-]+)", re.IGNORECASE),
]

RE_PROGRAMA = [
    re.compile(r"(?<!Descripci[oó]n\s)\b(?:Programa(?:\s+Acad[eé]mico)?|Plan\s+de\s+Estudios?|Carrera)\s*[:\t ]+\s*([^\n\r]+)", re.IGNORECASE),
]


def normalizar_texto(texto: str) -> str:
    """Elimina tildes y normaliza espacios en blanco."""
    texto_nfkd = unicodedata.normalize("NFKD", texto)
    sin_tildes = "".join(c for c in texto_nfkd if not unicodedata.combining(c))
    return sin_tildes


def normalizar_periodo(texto_periodo: str | None) -> str | None:
    """Normaliza un identificador de periodo al formato AAAA-1 o AAAA-2."""
    if not texto_periodo:
        return None

    texto = normalizar_texto(texto_periodo).strip()

    # Formato código Banner estándar de 6 dígitos: ej. 202410 -> 2024-1, 202420 -> 2024-2
    m_banner = re.search(r"\b(19\d\d|20\d\d)(10|20)\b", texto)
    if m_banner:
        anio, sem = m_banner.groups()
        return f"{anio}-{1 if sem == '10' else 2}"

    # Formato AAAA-(1|2), AAAA-01, AAAA-I, AAAA-II, etc.
    m_sem = re.search(
        r"\b(19\d\d|20\d\d)\s*[-/._\s]?\s*(?:0?([12])\b|(II|I)\b|P([12])\b)",
        texto,
        re.IGNORECASE,
    )
    if m_sem:
        anio = m_sem.group(1)
        sem_num = m_sem.group(2)
        sem_romano = m_sem.group(3)
        sem_p = m_sem.group(4)

        if sem_num:
            return f"{anio}-{sem_num}"
        if sem_romano:
            return f"{anio}-{2 if sem_romano.upper() == 'II' else 1}"
        if sem_p:
            return f"{anio}-{sem_p}"

    # Formato prefijo 1P-2024 o 2P-2024
    m_pref = re.search(r"\b([12])P\s*[-/._\s]?\s*(19\d\d|20\d\d)\b", texto, re.IGNORECASE)
    if m_pref:
        sem_num, anio = m_pref.groups()
        return f"{anio}-{sem_num}"

    return None


def avanzar_periodo(periodo: str, pasos: int) -> str | None:
    """Avanza o retrocede semestres académicos desde un periodo normalizado AAAA-1 o AAAA-2."""
    if not periodo or "-" not in periodo:
        return None
    try:
        anio_str, sem_str = periodo.split("-")
        anio = int(anio_str)
        sem = int(sem_str)
        total_semestres = (anio * 2 + (sem - 1)) + pasos
        nuevo_anio = total_semestres // 2
        nuevo_sem = (total_semestres % 2) + 1
        return f"{nuevo_anio}-{nuevo_sem}"
    except Exception:
        return None


def a_numero_entero(valor: Any) -> int | None:
    """Convierte un valor numérico o cadena de texto a entero."""
    if valor is None:
        return None
    if isinstance(valor, int):
        return valor
    if isinstance(valor, float):
        return int(round(valor))
    if isinstance(valor, str):
        v = valor.strip().replace(",", ".")
        try:
            f = float(v)
            return int(round(f))
        except ValueError:
            return None
    return None


@dataclass
class PeriodoExtraido:
    periodo_crudo: str | None
    periodo_normalizado: str | None
    credits_approved: int | None
    credits_total: int | None
    faltantes_declarados: int | None
    cumple_declarado: bool | None


@dataclass
class DatosDocumentoBanner:
    tiene_texto: bool
    es_banner: bool
    error: str | None
    full_name_student: str | None
    code_student: str | None
    program: str | None
    max_credits: int | None
    credits_approved: int | None
    periodos: list[PeriodoExtraido] = field(default_factory=list)


class ExtractorEvaluacionBanner:
    """Extrae la información estructurada de una Evaluación de Grado de Banner."""

    def extraer_desde_bytes_o_archivo(self, origen: bytes | str | Path) -> DatosDocumentoBanner:
        if isinstance(origen, (str, Path)):
            ruta = Path(origen)
            if not ruta.is_file():
                return DatosDocumentoBanner(
                    tiene_texto=False,
                    es_banner=False,
                    error=f"No se encontró el archivo: {ruta}",
                    full_name_student=None,
                    code_student=None,
                    program=None,
                    max_credits=None,
                    credits_approved=None,
                )
            try:
                contenido = ruta.read_bytes()
            except Exception as e:
                return DatosDocumentoBanner(
                    tiene_texto=False,
                    es_banner=False,
                    error=f"Error al leer el archivo: {e}",
                    full_name_student=None,
                    code_student=None,
                    program=None,
                    max_credits=None,
                    credits_approved=None,
                )
        else:
            contenido = origen

        if not contenido or len(contenido) < 10:
            return DatosDocumentoBanner(
                tiene_texto=False,
                es_banner=False,
                error=DANADO,
                full_name_student=None,
                code_student=None,
                program=None,
                max_credits=None,
                credits_approved=None,
            )

        try:
            doc = pymupdf.open(stream=contenido, filetype="pdf")
        except Exception:
            return DatosDocumentoBanner(
                tiene_texto=False,
                es_banner=False,
                error=DANADO,
                full_name_student=None,
                code_student=None,
                program=None,
                max_credits=None,
                credits_approved=None,
            )

        try:
            if doc.is_encrypted or doc.needs_pass:
                return DatosDocumentoBanner(
                    tiene_texto=False,
                    es_banner=False,
                    error=PROTEGIDO,
                    full_name_student=None,
                    code_student=None,
                    program=None,
                    max_credits=None,
                    credits_approved=None,
                )

            paginas_texto = []
            for pagina in doc:
                texto_pag = pagina.get_text(sort=True) or ""
                paginas_texto.append(texto_pag)

            texto_completo = "\n".join(paginas_texto).strip()
            if not texto_completo:
                return DatosDocumentoBanner(
                    tiene_texto=False,
                    es_banner=False,
                    error=SIN_TEXTO,
                    full_name_student=None,
                    code_student=None,
                    program=None,
                    max_credits=None,
                    credits_approved=None,
                )

            return self.extraer_desde_texto(texto_completo)

        finally:
            doc.close()

    def extraer_desde_texto(self, texto: str) -> DatosDocumentoBanner:
        texto_norm = normalizar_texto(texto).upper()

        # 1. Comprobar si es un documento de Banner
        es_banner = any(termino in texto_norm for termino in TERMINOS_BANNER)
        if not es_banner and "CUMPLE:" in texto_norm and ("CREDITOS" in texto_norm or "APROBADO" in texto_norm):
            es_banner = True

        if not es_banner:
            return DatosDocumentoBanner(
                tiene_texto=True,
                es_banner=False,
                error=NO_ES_BANNER,
                full_name_student=None,
                code_student=None,
                program=None,
                max_credits=None,
                credits_approved=None,
            )

        # 2. Extraer datos del estudiante
        nombre, codigo = self._extraer_identificacion_estudiante(texto)
        programa = self._extraer_programa(texto)

        # 3. Extraer créditos generales del programa
        max_creditos, creditos_aprobados = self._extraer_creditos_programa(texto)

        # 4. Extraer periodos / niveles
        periodos = self._extraer_periodos(texto)

        return DatosDocumentoBanner(
            tiene_texto=True,
            es_banner=True,
            error=None,
            full_name_student=nombre,
            code_student=codigo,
            program=programa,
            max_credits=max_creditos,
            credits_approved=creditos_aprobados,
            periodos=periodos,
        )

    def _extraer_identificacion_estudiante(self, texto: str) -> tuple[str | None, str | None]:
        nombre = None
        codigo = None

        # Patrón Banner Avance Académico: T00071286  MERCADO BOLIVAR, JAVIER E
        m_banner_id = re.search(r"^[ \t]*(T\d{8}|\d{6,12})[ \t]+([^\n\r]+)$", texto, re.MULTILINE)
        if m_banner_id:
            codigo = m_banner_id.group(1).strip()
            candidato_nombre = m_banner_id.group(2).strip()
            if "," in candidato_nombre:
                partes = [p.strip() for p in candidato_nombre.split(",", 1)]
                if len(partes) == 2 and partes[0] and partes[1]:
                    candidato_nombre = f"{partes[1]} {partes[0]}"
            nombre = candidato_nombre

        if not nombre:
            for patron in RE_NOMBRE:
                m = patron.search(texto)
                if m:
                    candidato = m.group(1).strip()
                    candidato = re.sub(r"^(?:T\d{8}|\d{6,12})\s*[-–—:]\s*", "", candidato)
                    candidato = re.split(r"\s{2,}|ID:|Código:|Programa:|Nivel:", candidato)[0].strip()
                    if "," in candidato:
                        partes = [p.strip() for p in candidato.split(",", 1)]
                        if len(partes) == 2 and partes[0] and partes[1]:
                            candidato = f"{partes[1]} {partes[0]}"
                    if candidato and len(candidato) >= 3:
                        nombre = candidato
                        break

        if not codigo:
            for patron in RE_CODIGO:
                for m in patron.finditer(texto):
                    candidato = m.group(1).strip()
                    if nombre and candidato.upper() in nombre.upper():
                        continue
                    if re.match(r"^T\d{8}$|^\d{6,12}$", candidato, re.IGNORECASE):
                        codigo = candidato.upper()
                        break
                if codigo:
                    break

        return nombre, codigo

    def _extraer_programa(self, texto: str) -> str | None:
        for patron in RE_PROGRAMA:
            m = patron.search(texto)
            if m:
                candidato = m.group(1).strip()
                if candidato.lower().startswith("programa:"):
                    continue
                candidato = re.split(
                    r"\s{2,}|Nivel:|Campus:|Colegio:|Grado:|Periodo Cat|Periodo Eval",
                    candidato,
                )[0].strip()
                if candidato and len(candidato) >= 3:
                    return candidato

        # Inferir de los encabezados de Área (ej. PRIMER SEMESTRE - I. SIS Y COM)
        m_area_prog = re.search(r"Área:\s*[^-\n]+-\s*([^\n]+)", texto, re.IGNORECASE)
        if m_area_prog:
            sufijo = m_area_prog.group(1).strip()
            # Limpiar posibles columnas pegadas al final
            sufijo = re.split(r"\s{2,}|Cumplimient|Créditos", sufijo)[0].strip()
            if sufijo in MAPA_PROGRAMAS_UTB:
                return MAPA_PROGRAMAS_UTB[sufijo]
            if len(sufijo) >= 3:
                return sufijo

        return None

    def _extraer_creditos_programa(self, texto: str) -> tuple[int | None, int | None]:
        # Formato Banner CAPP: "Total Requerido       no           162        133        54          47"
        m_tot_req = re.search(
            r"Total\s+Requerido\s+(?:no|si|s[ií])\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)",
            texto,
            re.IGNORECASE,
        )
        if m_tot_req:
            max_c = a_numero_entero(m_tot_req.group(1))
            apr_c = a_numero_entero(m_tot_req.group(2))
            return max_c, apr_c

        max_cred = None
        aprobados = None

        m_bloque = re.search(
            r"(?:Cr[eé]ditos\s+del\s+Programa|Total\s+Cr[eé]ditos|Resumen\s+de\s+Cr[eé]ditos)[^\n]*\n([^\n]+)",
            texto,
            re.IGNORECASE,
        )
        texto_busqueda = m_bloque.group(0) if m_bloque else texto

        m_req = re.search(
            r"(?:Cr[eé]ditos\s+(?:del\s+Programa\s+)?(?:Requeridos|Exigidos|Totales)|Requeridos|Exigidos)\s*[:\t ]+\s*(\d+(?:[.,]\d+)?)",
            texto_busqueda,
            re.IGNORECASE,
        )
        if m_req:
            max_cred = a_numero_entero(m_req.group(1))

        m_apr = re.search(
            r"(?:Cr[eé]ditos\s+(?:del\s+Programa\s+)?(?:Aplicados|Aprobados|Obtenidos|Utilizados)|Aplicados|Aprobados)\s*[:\t ]+\s*(\d+(?:[.,]\d+)?)",
            texto_busqueda,
            re.IGNORECASE,
        )
        if m_apr:
            aprobados = a_numero_entero(m_apr.group(1))

        return max_cred, aprobados

    def _extraer_periodos(self, texto: str) -> list[PeriodoExtraido]:
        # Revisar si el documento está en formato Banner CAPP "Requerimientos Área"
        if re.search(r"Requerimientos\s+Área", texto, re.IGNORECASE):
            return self._extraer_periodos_capp_utb(texto)

        periodos: list[PeriodoExtraido] = []

        patron_bloque = re.compile(
            r"(?:^|\n)(?:(?:[ÁA]rea\s*[:\t ]+|Nivel\s+[IVXLCDM\d]+\s*[-–—:]?\s*|Periodo(?:\s+Acad[eé]mico)?\s*[:\t ]+)([^\n]+))",
            re.IGNORECASE,
        )

        divisiones = list(patron_bloque.finditer(texto))
        if len(divisiones) >= 1:
            for idx, m_div in enumerate(divisiones):
                encabezado = m_div.group(1).strip()
                inicio = m_div.end()
                fin = divisiones[idx + 1].start() if idx + 1 < len(divisiones) else len(texto)
                cuerpo_bloque = texto[inicio:fin]
                bloque_completo = encabezado + "\n" + cuerpo_bloque

                p = self._parsear_bloque_periodo(encabezado, bloque_completo)
                if p:
                    periodos.append(p)

        if not periodos:
            periodos = self._extraer_periodos_tabulares(texto)

        return periodos

    def _extraer_periodos_capp_utb(self, texto: str) -> list[PeriodoExtraido]:
        """Extrae áreas/periodos del formato Banner CAPP (ej. UTB). Valida correspondencia semestre-periodo."""
        bloques = re.split(r"Requerimientos\s+Área", texto, flags=re.IGNORECASE)
        vistos: set[str] = set()
        areas_datos: list[dict[str, Any]] = []

        for bloque in bloques[1:]:
            m_area = re.search(r"Área:\s*([^\n]+)", bloque, re.IGNORECASE)
            if not m_area:
                continue

            nombre_crudo = m_area.group(1).strip()
            # Nombre limpio para deduplicar (ej. PRIMER SEMESTRE)
            nombre_limpio = nombre_crudo.split("-")[0].strip().upper()
            if nombre_limpio in vistos:
                continue
            vistos.add(nombre_limpio)

            # Extraer número de semestre ordinal si existe
            num_semestre = None
            for ordinal, num in ORDINALES_SEMESTRES.items():
                if re.search(rf"\b{ordinal}\b", nombre_limpio):
                    num_semestre = num
                    break

            # Extraer cumplimiento y créditos: si/no Requerido Usado
            m_cump = re.search(r"\b(si|no|s[ií])\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)", bloque, re.IGNORECASE)
            if not m_cump:
                continue

            cumple_declarado = m_cump.group(1).lower() in ("si", "sí")
            tot = a_numero_entero(m_cump.group(2))
            apr = a_numero_entero(m_cump.group(3))
            fal = max(0, tot - apr) if (tot is not None and apr is not None) else None

            # Cursos dentro del área (antes de 'Total Créditos y PGA')
            m_det = re.search(r"Requerimientos\s+de\s+Detalle(.*?)Total\s+Créditos\s+y\s+PGA", bloque, re.DOTALL | re.IGNORECASE)
            txt_det = m_det.group(1) if m_det else bloque
            periodos_cursos = [
                f"{a}{s}"
                for a, s in re.findall(r"\b(19\d\d|20\d\d)(10|20)\b", txt_det)
            ]

            areas_datos.append(
                {
                    "nombre_crudo": nombre_crudo.split("-")[0].strip(),
                    "nombre_limpio": nombre_limpio,
                    "num_semestre": num_semestre,
                    "credits_approved": apr,
                    "credits_total": tot,
                    "faltantes": fal,
                    "cumple": cumple_declarado,
                    "periodos_cursos": periodos_cursos,
                }
            )

        # Extraer Periodo de Evaluación del documento si existe (ej. 202620 -> 2026-2)
        m_eval = re.search(r"Periodo\s+Evaluacion:\s*(\d{6})", texto, re.IGNORECASE)
        periodo_eval_norm = normalizar_periodo(m_eval.group(1)) if m_eval else None

        return self._resolver_secuencia_semestres(areas_datos, periodo_eval_norm)

    def _resolver_secuencia_semestres(
        self,
        areas: list[dict[str, Any]],
        periodo_eval_norm: str | None,
    ) -> list[PeriodoExtraido]:
        resultado: list[PeriodoExtraido] = []
        if not areas:
            return resultado

        # Comprobar si las áreas tienen numeración de semestre
        semestres_numerados = [a for a in areas if a["num_semestre"] is not None]
        tiene_malla_semestres = len(semestres_numerados) >= len(areas) * 0.7

        periodo_base = None
        num_base = None

        if tiene_malla_semestres:
            # Buscar el periodo inicial en el Semestre 1
            for a in semestres_numerados:
                if a["num_semestre"] == 1 and a["periodos_cursos"]:
                    p_comun = Counter(a["periodos_cursos"]).most_common(1)[0][0]
                    periodo_base = normalizar_periodo(p_comun)
                    num_base = 1
                    break

            # Si no hay Semestre 1 con cursos, buscar el primer semestre con cursos consistentes
            if not periodo_base:
                for a in semestres_numerados:
                    if a["periodos_cursos"]:
                        p_comun = Counter(a["periodos_cursos"]).most_common(1)[0][0]
                        periodo_base = normalizar_periodo(p_comun)
                        num_base = a["num_semestre"]
                        break

        periodos_usados: set[str] = set()

        for a in areas:
            p_asignado = None
            num_sem = a["num_semestre"]

            # Si tenemos secuencia base y número de semestre
            if periodo_base and num_base is not None and num_sem is not None:
                desplazamiento = num_sem - num_base
                p_candidato = avanzar_periodo(periodo_base, desplazamiento)

                # Validar coherencia: no debe coincidir con un periodo ya asignado a otro semestre
                if p_candidato and p_candidato not in periodos_usados:
                    p_asignado = p_candidato
            elif a["periodos_cursos"]:
                p_comun = Counter(a["periodos_cursos"]).most_common(1)[0][0]
                p_cand = normalizar_periodo(p_comun)
                if p_cand and p_cand not in periodos_usados:
                    p_asignado = p_cand

            # Regla estricta: No repetir periodos entre semestres diferentes
            if p_asignado and p_asignado in periodos_usados:
                p_asignado = None

            if p_asignado:
                periodos_usados.add(p_asignado)

            resultado.append(
                PeriodoExtraido(
                    periodo_crudo=a["nombre_crudo"],
                    periodo_normalizado=p_asignado,
                    credits_approved=a["credits_approved"],
                    credits_total=a["credits_total"],
                    faltantes_declarados=a["faltantes"],
                    cumple_declarado=a["cumple"],
                )
            )

        return resultado

    def _parsear_bloque_periodo(self, encabezado: str, bloque: str) -> PeriodoExtraido | None:
        m_periodo = re.search(
            r"\b(19\d\d|20\d\d)[-_/.\s]?(?:10|20|0?1|0?2|II|I)\b|\b(?:[12])P[-_/.\s]?(?:19\d\d|20\d\d)\b",
            encabezado,
            re.IGNORECASE,
        )
        if not m_periodo:
            m_periodo = re.search(
                r"(?:Periodo|Semestre)\s*[:\t ]+\s*([^\n\r,]+)",
                bloque,
                re.IGNORECASE,
            )

        periodo_crudo = m_periodo.group(0).strip() if m_periodo else encabezado
        periodo_norm = normalizar_periodo(periodo_crudo)

        cumple = None
        m_cumple = re.search(r"\b(?:Cumple|Met)\s*[:\t ]+\s*(S[ií]|No|Yes)\b", bloque, re.IGNORECASE)
        if m_cumple:
            val = m_cumple.group(1).upper()
            cumple = val in ("SI", "SÍ", "YES")

        cred_total = None
        m_tot = re.search(r"(?:Requeridos|Exigidos|Total(?:\s+Cr[eé]ditos)?)\s*[:\t ]+\s*(\d+(?:[.,]\d+)?)", bloque, re.IGNORECASE)
        if m_tot:
            cred_total = a_numero_entero(m_tot.group(1))

        cred_apr = None
        m_apr = re.search(r"(?:Aplicados|Aprobados|Utilizados)\s*[:\t ]+\s*(\d+(?:[.,]\d+)?)", bloque, re.IGNORECASE)
        if m_apr:
            cred_apr = a_numero_entero(m_apr.group(1))

        faltantes = None
        m_fal = re.search(r"(?:Faltantes|Pendientes|Por\s+aprobar)\s*[:\t ]+\s*(\d+(?:[.,]\d+)?)", bloque, re.IGNORECASE)
        if m_fal:
            faltantes = a_numero_entero(m_fal.group(1))

        if cred_total is None and cred_apr is None and cumple is None:
            return None

        return PeriodoExtraido(
            periodo_crudo=periodo_crudo,
            periodo_normalizado=periodo_norm,
            credits_approved=cred_apr,
            credits_total=cred_total,
            faltantes_declarados=faltantes,
            cumple_declarado=cumple,
        )

    def _extraer_periodos_tabulares(self, texto: str) -> list[PeriodoExtraido]:
        lineas = texto.splitlines()
        resultados = []

        re_fila = re.compile(
            r"^\s*([A-Za-z0-9_/-]+)\s+(S[ií]|No)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(?:\s+(\d+(?:[.,]\d+)?))?",
            re.IGNORECASE,
        )

        for linea in lineas:
            m = re_fila.match(linea)
            if m:
                p_crudo, cump_str, c_tot, c_apr, c_fal = m.groups()
                p_norm = normalizar_periodo(p_crudo)
                cumple = cump_str.upper() in ("SI", "SÍ")
                cred_tot = a_numero_entero(c_tot)
                cred_apr = a_numero_entero(c_apr)
                falt = a_numero_entero(c_fal) if c_fal else None

                resultados.append(
                    PeriodoExtraido(
                        periodo_crudo=p_crudo,
                        periodo_normalizado=p_norm,
                        credits_approved=cred_apr,
                        credits_total=cred_tot,
                        faltantes_declarados=falt,
                        cumple_declarado=cumple,
                    )
                )

        return resultados
