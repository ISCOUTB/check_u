from datetime import datetime, timezone
from pathlib import Path

import pytest

from modules.validadores.saber_pro.firma import EstadoFirma, _estado_certificado, verificar

RAIZ = Path(__file__).resolve().parents[4]
MUESTRAS_FIRMA = RAIZ / "firma_electronica" / "test" / "samples"

AHORA = datetime(2026, 10, 17, 17, 0, tzinfo=timezone.utc)
FIRMADO_EN = datetime(2026, 10, 17, 17, 2, tzinfo=timezone.utc)
VIGENTE_HASTA = datetime(2027, 12, 2, tzinfo=timezone.utc)
VENCIDO_EL = datetime(2025, 12, 2, tzinfo=timezone.utc)


def muestra(nombre: str) -> bytes:
    return (MUESTRAS_FIRMA / f"PAZ Y SALVO BIBLIOTECA{nombre}.pdf").read_bytes()


def test_muestra_de_biblioteca_firmante_no_es_icfes():
    estado = verificar(muestra(" firmado"), consultar_revocacion=False)
    assert estado.presencia == "presente"
    assert estado.intacta is True
    assert estado.firmante == "Biblioteca"
    assert estado.firmante_es_icfes is False
    assert estado.certificado == "no_confiable"


def test_muestra_modificada():
    estado = verificar(muestra(" modificado"), consultar_revocacion=False)
    assert estado.presencia == "presente"
    assert estado.intacta is False


def test_sin_firma():
    assert verificar(muestra(""), consultar_revocacion=False).presencia == "ausente"


@pytest.mark.parametrize("contenido", [b"", b"no es un pdf"])
def test_bytes_danados(contenido):
    estado = verificar(contenido, consultar_revocacion=False)
    assert estado.presencia == "ausente"
    assert estado.intacta is None


def test_copias_del_equipo_no_verificables(muestras_de_tipo):
    for nombre, reporte in muestras_de_tipo("reporte").items():
        estado = verificar(reporte["contenido"], consultar_revocacion=False)
        assert estado.presencia == "no_verificable", nombre
        assert estado.intacta is None, nombre


def base(**cambios) -> dict:
    resultado = {
        "certificate_trusted": False,
        "revoked": False,
        "trust_problem": None,
        "signer_not_after": VIGENTE_HASTA,
        "signer_reported_time": FIRMADO_EN,
    }
    return {**resultado, **cambios}


@pytest.mark.parametrize(
    ("resultado", "esperado"),
    [
        (base(certificate_trusted=True), "valido"),
        (base(revoked=True, trust_problem="REVOKED"), "revocado"),
        (base(trust_problem="EXPIRED"), "vencido"),
        (base(trust_problem="OUT_OF_BOUNDS_NO_POE"), "vencido"),
        (base(signer_not_after=VENCIDO_EL, trust_problem="NO_CERTIFICATE_CHAIN_FOUND"), "vencido"),
        (base(trust_problem="NO_CERTIFICATE_CHAIN_FOUND"), "no_confiable"),
        (base(trust_problem="CHAIN_CONSTRAINTS_FAILURE"), "no_confiable"),
        (base(trust_problem="TRY_LATER"), "sin_respuesta"),
        (base(trust_problem="GENERIC"), "desconocido"),
        (base(signer_reported_time=None, signer_not_after=VENCIDO_EL), "vencido"),
    ],
)
def test_mapeo_de_problemas_de_confianza(resultado, esperado):
    assert _estado_certificado(resultado, AHORA) == esperado


class ValidadorFalso:
    """Registra con qué allow_fetching lo llaman y devuelve una firma intacta del ICFES."""

    def __init__(self, vence: datetime):
        self.llamadas = []
        self.vence = vence

    def validate_bytes(self, data: bytes, *, allow_fetching: bool | None = None) -> dict:
        self.llamadas.append(allow_fetching)
        return {
            "signed": True,
            "valid": False,
            "modified": False,
            "certificate_trusted": bool(allow_fetching),
            "message": "",
            "signature_valid": True,
            "entire_file": True,
            "signer_organization": "INSTITUTO COLOMBIANO PARA LA EVALUACION DE LA EDUCACION ICFES",
            "signer_serial_number": "8600243016",
            "signer_not_after": self.vence,
            "signer_reported_time": FIRMADO_EN,
            "revoked": False,
            "trust_problem": None if allow_fetching else "NO_CERTIFICATE_CHAIN_FOUND",
        }


def test_vencido_no_consulta_revocacion():
    validador = ValidadorFalso(VENCIDO_EL)
    estado = verificar(b"%PDF", validador=validador)
    assert validador.llamadas == [False]
    assert estado.certificado == "vencido"
    assert estado.vence == VENCIDO_EL
    assert estado.firmante_es_icfes is True
    assert estado.intacta is True


def test_vigente_consulta_revocacion():
    validador = ValidadorFalso(VIGENTE_HASTA)
    estado = verificar(b"%PDF", validador=validador)
    assert validador.llamadas == [False, True]
    assert estado.certificado == "valido"


def test_sin_consultar_revocacion_una_sola_llamada():
    validador = ValidadorFalso(VIGENTE_HASTA)
    verificar(b"%PDF", consultar_revocacion=False, validador=validador)
    assert validador.llamadas == [False]


def test_raices_de_camerfirma_se_cargan():
    from firma_electronica.infra.sign_validator import SignatureValidator
    from modules.validadores.saber_pro.firma import raices_camerfirma

    nombres = [ruta.name for ruta in raices_camerfirma()]
    assert nombres == ["root-camerfirma-colombia-v2.crt", "subca-camerfirma-colombia-sas-v2.crt"]
    SignatureValidator(trusted_cert_paths=raices_camerfirma())


def test_estado_firma_es_inmutable():
    estado = EstadoFirma("ausente", None, None, None, None, None, None)
    with pytest.raises(AttributeError):
        estado.presencia = "presente"
