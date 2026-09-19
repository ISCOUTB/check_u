from pathlib import Path
import tempfile

import pymupdf

from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers


class PDFSigner:
    """Realiza la firma criptográfica de documentos PDF."""

    def __init__(
        self,
        certificate_path: Path,
        private_key_path: Path
    ):
        self.certificate_path = certificate_path
        self.private_key_path = private_key_path

        self.signer = signers.SimpleSigner.load(
            cert_file=str(self.certificate_path),
            key_file=str(self.private_key_path)
        )

    def add_footer(
        self,
        input_path: Path,
        output_path: Path
    ):
        """Agrega la identificación visual de la Biblioteca."""

        document = pymupdf.open(input_path)

        try:
            for page in document:

                page_width = page.rect.width
                page_height = page.rect.height

                text = "PDF firmado por la Biblioteca"

                font_size = 9

                text_width = pymupdf.get_text_length(
                    text,
                    fontname="helv",
                    fontsize=font_size
                )

                x = (
                    page_width - text_width
                ) / 2

                y = page_height - 20

                page.insert_text(
                    (x, y),
                    text,
                    fontsize=font_size,
                    fontname="helv"
                )

            document.save(output_path)

        finally:
            document.close()

    def sign(
        self,
        input_path: Path,
        output_path: Path
    ):
        """Agrega el pie de página y firma el PDF."""

        # Creamos un archivo temporal para preparar
        # el documento antes de firmarlo.
        with tempfile.TemporaryDirectory() as temp_dir:

            prepared_pdf = (
                Path(temp_dir)
                / "documento_preparado.pdf"
            )

            # 1. Agregar pie de página
            self.add_footer(
                input_path,
                prepared_pdf
            )

            # 2. Firmar el documento preparado
            with open(
                prepared_pdf,
                "rb"
            ) as input_file:

                writer = IncrementalPdfFileWriter(
                    input_file,
                    strict=False
                )

                signature_meta = (
                    signers.PdfSignatureMetadata(
                        field_name="FirmaBiblioteca",
                        reason=(
                            "Documento firmado por la Biblioteca"
                        )
                    )
                )

                pdf_signer = signers.PdfSigner(
                    signature_meta,
                    signer=self.signer
                )

                with open(
                    output_path,
                    "wb"
                ) as output_file:

                    pdf_signer.sign_pdf(
                        writer,
                        output=output_file
                    )