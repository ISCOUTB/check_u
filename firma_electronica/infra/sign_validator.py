import logging
from collections.abc import Sequence
from io import BytesIO
from pathlib import Path

from asn1crypto import pem, x509
from cryptography.exceptions import InvalidSignature
from cryptography.x509 import load_der_x509_certificate
from pyhanko_certvalidator import ValidationContext
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko.sign.validation.status import SignatureCoverageLevel

BASE_DIR = Path(__file__).resolve().parent.parent
TRUSTED_CERT_PATH = BASE_DIR / "certificados" / "biblioteca.crt"

# pyHanko registra con traza completa cada certificado que no puede validar; el resultado ya lo dice.
_REGISTROS_PYHANKO = ("pyhanko", "pyhanko_certvalidator")


def _load_trusted_cert(path: Path) -> x509.Certificate:
    data = path.read_bytes()
    if pem.detect(data):
        _, _, data = pem.unarmor(data)
    return x509.Certificate.load(data)


def certificate_issued_by(cert: x509.Certificate, issuers: Sequence[x509.Certificate]) -> bool:
    """True si alguno de los emisores firmó directamente el certificado, aunque esté vencido.

    Prueba quién emitió el certificado sin depender de su vigencia: un certificado que solo dice
    ser de alguien (por ejemplo, autofirmado con su NIT) no pasa.
    """
    child = load_der_x509_certificate(cert.dump())
    for issuer in issuers:
        try:
            child.verify_directly_issued_by(load_der_x509_certificate(issuer.dump()))
            return True
        except (ValueError, TypeError, InvalidSignature):
            continue
    return False


class SignatureValidator:
    """Valida firmas digitales presentes en documentos PDF."""

    def __init__(
        self,
        trusted_cert_path: Path = TRUSTED_CERT_PATH,
        *,
        trusted_cert_paths: Sequence[Path] | None = None,
        allow_fetching: bool = False,
    ):
        """trusted_cert_paths reemplaza a trusted_cert_path cuando se necesitan varias raíces.

        allow_fetching consulta en internet la revocación del certificado (OCSP/CRL).
        """
        paths = list(trusted_cert_paths) if trusted_cert_paths is not None else [trusted_cert_path]
        self._trust_roots = [_load_trusted_cert(path) for path in paths]
        self._allow_fetching = allow_fetching

    def validate(self, pdf_path: Path) -> dict:
        """Valida la primera firma digital encontrada."""

        with open(pdf_path, "rb") as pdf_file:
            return self.validate_bytes(pdf_file.read())

    def validate_bytes(self, data: bytes, *, allow_fetching: bool | None = None) -> dict:
        """Como validate, pero con el PDF en memoria; allow_fetching cambia el valor del constructor."""

        reader = PdfFileReader(BytesIO(data), strict=False)
        signatures = reader.embedded_signatures

        if not signatures:
            return {
                "signed": False,
                "valid": False,
                "modified": False,
                "certificate_trusted": False,
                "message": "El documento no contiene una firma digital.",
                "signature_valid": False,
                "entire_file": False,
                "signer_organization": None,
                "signer_serial_number": None,
                "signer_not_after": None,
                "signer_reported_time": None,
                "revoked": False,
                "trust_problem": None,
                "issued_by_trusted_root": False,
            }

        context = ValidationContext(
            trust_roots=self._trust_roots,
            allow_fetching=self._allow_fetching if allow_fetching is None else allow_fetching,
        )
        status = self._validate_quietly(signatures[0], context)

        intact = status.intact
        trusted = status.trusted
        subject = status.signing_cert.subject.native
        validity = status.signing_cert["tbs_certificate"]["validity"]

        return {
            "signed": True,
            "valid": status.bottom_line,
            "modified": not intact,
            "certificate_trusted": trusted,
            "message": self._get_message(intact, trusted, status.bottom_line),
            "signature_valid": status.valid,
            "entire_file": status.coverage == SignatureCoverageLevel.ENTIRE_FILE,
            "signer_organization": subject.get("organization_name"),
            "signer_serial_number": subject.get("serial_number"),
            "signer_not_after": validity["not_after"].native,
            "signer_reported_time": status.signer_reported_dt,
            "revoked": bool(status.revoked),
            "trust_problem": status.trust_problem_indic.name if status.trust_problem_indic else None,
            "issued_by_trusted_root": certificate_issued_by(status.signing_cert, self._trust_roots),
        }

    @staticmethod
    def _validate_quietly(signature, context):
        loggers = [logging.getLogger(name) for name in _REGISTROS_PYHANKO]
        levels = [logger.level for logger in loggers]
        for logger in loggers:
            logger.setLevel(logging.CRITICAL)
        try:
            return validate_pdf_signature(signature, signer_validation_context=context)
        finally:
            for logger, level in zip(loggers, levels):
                logger.setLevel(level)

    @staticmethod
    def _get_message(intact: bool, trusted: bool, bottom_line: bool) -> str:

        if not intact:
            return (
                "La firma digital no es válida "
                "porque el documento fue modificado "
                "después de la firma."
            )

        if bottom_line:
            return (
                "La firma digital es válida "
                "y el documento no ha sido modificado."
            )

        if not trusted:
            return (
                "La firma está presente y el documento no ha sido "
                "modificado, pero el certificado no es de confianza "
                "(es autofirmado y no está registrado como raíz "
                "de confianza)."
            )

        return (
            "La firma está presente, pero "
            "no se pudo establecer su validez."
        )
