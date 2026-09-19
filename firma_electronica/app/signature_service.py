from pathlib import Path

from infra.crypto_sig import PDFSigner


class SignatureService:
    """Contiene la lógica del proceso de firma."""

    def __init__(self):

        base_dir = Path(__file__).resolve().parent.parent

        certificate_path = (
            base_dir
            / "certificados"
            / "biblioteca.crt"
        )

        private_key_path = (
            base_dir
            / "certificados"
            / "biblioteca.key"
        )

        self.pdf_signer = PDFSigner(
            certificate_path,
            private_key_path
        )

    def sign_document(self, document_path: Path) -> Path:
        """Firma el documento y devuelve la ruta de la copia firmada."""

        output_path = document_path.with_name(
            f"{document_path.stem}_firmado.pdf"
        )

        self.pdf_signer.sign(
            document_path,
            output_path
        )

        return output_path