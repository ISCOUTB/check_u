from pathlib import Path

from config.paths import find_cert_dir
from infra.crypto_sig import PDFSigner


class SignatureService:
    """Contiene la lógica del proceso de firma."""

    def _build_signer(self, passphrase: str | None) -> PDFSigner:
        cert_dir = find_cert_dir()

        return PDFSigner(
            certificate_path=cert_dir / "biblioteca.crt",
            private_key_path=cert_dir / "biblioteca.key",
            key_passphrase=passphrase,
        )

    def sign_document(
        self,
        document_path: Path,
        passphrase: str | None = None,
    ) -> Path:
        """Firma el documento y devuelve la ruta de la copia firmada."""

        output_path = document_path.with_name(
            f"{document_path.stem}_firmado.pdf"
        )

        # La clave se carga solo al firmar, no al abrir la aplicación.
        signer = self._build_signer(passphrase)
        signer.sign(document_path, output_path)

        return output_path