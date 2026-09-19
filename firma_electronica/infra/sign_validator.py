from pathlib import Path

from asn1crypto import pem, x509
from pyhanko_certvalidator import ValidationContext
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.validation import validate_pdf_signature

BASE_DIR = Path(__file__).resolve().parent.parent
TRUSTED_CERT_PATH = BASE_DIR / "certificados" / "biblioteca.crt"


def _load_trusted_cert(path: Path) -> x509.Certificate:
    data = path.read_bytes()
    if pem.detect(data):
        _, _, data = pem.unarmor(data)
    return x509.Certificate.load(data)


class SignatureValidator:
    """Valida firmas digitales presentes en documentos PDF."""

    def __init__(self, trusted_cert_path: Path = TRUSTED_CERT_PATH):
        trusted_cert = _load_trusted_cert(trusted_cert_path)
        self._validation_context = ValidationContext(
            trust_roots=[trusted_cert]
        )

    def validate(self, pdf_path: Path) -> dict:
        """Valida la primera firma digital encontrada."""

        with open(pdf_path, "rb") as pdf_file:

            reader = PdfFileReader(pdf_file, strict=False)
            signatures = reader.embedded_signatures

            if not signatures:
                return {
                    "signed": False,
                    "valid": False,
                    "modified": False,
                    "certificate_trusted": False,
                    "message": "El documento no contiene una firma digital."
                }

            signature = signatures[0]

            status = validate_pdf_signature(
                signature,
                signer_validation_context=self._validation_context
            )

            intact = status.intact
            trusted = status.trusted

            return {
                "signed": True,
                "valid": status.bottom_line,
                "modified": not intact,
                "certificate_trusted": trusted,
                "message": self._get_message(intact, trusted, status.bottom_line)
            }

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