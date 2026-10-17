"""Firma digital del ICFES en el reporte Saber Pro, con el verificador de firma_electronica/.

Distingue tres casos: sin firma; firma no verificable (quedan restos de la firma, pero el archivo
se guardó de nuevo y ya no contiene lo que se firmó, como pasa al abrirlo en el navegador y
guardarlo); y firma presente, que pyHanko valida. Confía en los certificados públicos de
Camerfirma Colombia de certificados/ y exige que el firmante sea el ICFES por su NIT.
"""

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from firma_electronica.infra.sign_validator import SignatureValidator

CARPETA_CERTIFICADOS = Path(__file__).resolve().parent / "certificados"
NIT_ICFES = "8600243016"
RESTOS_DE_FIRMA = re.compile(rb"/(?:Type|FT)\s*/Sig\b")

# Nombres de AdESIndeterminate / AdESFailure de pyHanko.
PROBLEMAS_VENCIDO = {"EXPIRED", "OUT_OF_BOUNDS_NO_POE", "OUT_OF_BOUNDS_NOT_REVOKED", "NOT_YET_VALID"}
PROBLEMAS_SIN_CADENA = {
    "NO_CERTIFICATE_CHAIN_FOUND",
    "CHAIN_CONSTRAINTS_FAILURE",
    "CERTIFICATE_CHAIN_GENERAL_FAILURE",
}
PROBLEMAS_SIN_RESPUESTA = {"TRY_LATER", "REVOCATION_OUT_OF_BOUNDS_NO_POE"}

Presencia = Literal["ausente", "no_verificable", "presente"]
Certificado = Literal["valido", "vencido", "revocado", "no_confiable", "sin_respuesta", "desconocido"]


@dataclass(frozen=True)
class EstadoFirma:
    presencia: Presencia
    intacta: bool | None
    firmante: str | None
    firmante_es_icfes: bool | None
    certificado: Certificado | None
    vence: datetime | None
    detalle: str | None


def raices_camerfirma() -> list[Path]:
    return sorted(CARPETA_CERTIFICADOS.glob("*.crt"))


def _estado_certificado(resultado: dict, ahora: datetime) -> Certificado:
    vence = resultado["signer_not_after"]
    firmado = resultado["signer_reported_time"] or ahora
    if vence is not None and vence < firmado:
        return "vencido"
    if resultado["revoked"]:
        return "revocado"
    if resultado["certificate_trusted"]:
        return "valido"
    problema = resultado["trust_problem"]
    if problema in PROBLEMAS_VENCIDO:
        return "vencido"
    if problema in PROBLEMAS_SIN_CADENA:
        return "no_confiable"
    if problema in PROBLEMAS_SIN_RESPUESTA:
        return "sin_respuesta"
    return "desconocido"


def _sin_firma_valida(contenido: bytes, detalle: str) -> EstadoFirma:
    presencia = "no_verificable" if RESTOS_DE_FIRMA.search(contenido) else "ausente"
    return EstadoFirma(presencia, None, None, None, None, None, detalle)


def verificar(
    contenido: bytes,
    *,
    consultar_revocacion: bool = True,
    validador: SignatureValidator | None = None,
) -> EstadoFirma:
    """Nunca lanza por un PDF dañado. Con el certificado vencido no consulta la revocación."""
    validador = validador or SignatureValidator(trusted_cert_paths=raices_camerfirma())
    try:
        resultado = validador.validate_bytes(contenido, allow_fetching=False)
    except Exception:  # pyHanko lanza varios tipos con un PDF dañado
        return _sin_firma_valida(contenido, "No se pudo leer la estructura del PDF.")
    if not resultado["signed"]:
        return _sin_firma_valida(contenido, resultado["message"])

    ahora = datetime.now(timezone.utc)
    vencido_al_firmar = _estado_certificado(resultado, ahora) == "vencido"
    if consultar_revocacion and not vencido_al_firmar:
        try:
            resultado = validador.validate_bytes(contenido, allow_fetching=True)
        except Exception:  # la red o la autoridad certificadora fallaron
            resultado = {**resultado, "certificate_trusted": False, "trust_problem": "TRY_LATER"}

    return EstadoFirma(
        presencia="presente",
        intacta=resultado["signature_valid"] and not resultado["modified"] and resultado["entire_file"],
        firmante=resultado["signer_organization"],
        firmante_es_icfes=resultado["signer_serial_number"] == NIT_ICFES,
        certificado=_estado_certificado(resultado, ahora),
        vence=resultado["signer_not_after"],
        detalle=resultado["message"],
    )
