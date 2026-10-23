"""Firma de la Biblioteca en el Paz y Salvo, con el verificador de firma_electronica/.

Decisión 2 del spec (Héctor, 21/10/2026): solo se verifica la INTEGRIDAD y el NOMBRE del firmante;
el certificado no se valida (el de la Biblioteca no está en el repositorio y la issue prohíbe
subir certificados). Por eso, desde el 23/10/2026, una firma "de la Biblioteca" no aprueba sola
(ver reglas._regla_firma): un certificado propio con ese nombre podría ser falso.
"""

import unicodedata
from dataclasses import dataclass

from firma_electronica.infra.sign_validator import SignatureValidator

from ..firma_pdf import Presencia, esta_intacta, leer_firma

MARCA_BIBLIOTECA = "BIBLIOTECA"


@dataclass(frozen=True)
class FirmaBiblioteca:
    presencia: Presencia
    intacta: bool | None
    firmante: str | None
    firmante_es_biblioteca: bool | None


def _sin_tildes(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFKD", texto.upper())
    return "".join(c for c in descompuesto if not unicodedata.combining(c))


def es_biblioteca(organizacion: str | None, nombre_comun: str | None) -> bool:
    """La organización (O) o el nombre común (CN) del certificado contienen "BIBLIOTECA"."""
    return any(MARCA_BIBLIOTECA in _sin_tildes(valor) for valor in (organizacion, nombre_comun) if valor)


def verificar(contenido: bytes, *, validador=None) -> FirmaBiblioteca:
    """Nunca lanza por un PDF dañado. No consulta internet."""
    lectura = leer_firma(contenido, validador or SignatureValidator(trusted_cert_paths=[]))
    if lectura.presencia != "presente":
        return FirmaBiblioteca(lectura.presencia, None, None, None)
    resultado = lectura.resultado
    organizacion, nombre_comun = resultado["signer_organization"], resultado["signer_common_name"]
    return FirmaBiblioteca(
        presencia="presente",
        intacta=esta_intacta(resultado),
        firmante=organizacion or nombre_comun,
        firmante_es_biblioteca=es_biblioteca(organizacion, nombre_comun),
    )
