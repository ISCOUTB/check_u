from pathlib import Path
import tempfile

import pymupdf

from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers
import calendar
from datetime import date

VALIDITY_MONTHS = 3


def add_months(start: date, months: int) -> date:
    """Suma meses calendario (9 oct + 3 meses = 9 ene). Si el día no
    existe en el mes destino, usa el último día (31 oct + 4 meses = 28 feb)."""
    index = start.month - 1 + months
    year = start.year + index // 12
    month = index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)

class PDFSigner:
    """Realiza la firma criptográfica de documentos PDF."""

    def __init__(
        self,
        certificate_path: Path,
        private_key_path: Path,
        key_passphrase: str | None = None
    ):
        self.certificate_path = certificate_path
        self.private_key_path = private_key_path

        passphrase = (
            key_passphrase.encode("utf-8")
            if key_passphrase
            else None
        )

        self.signer = signers.SimpleSigner.load(
            cert_file=str(self.certificate_path),
            key_file=str(self.private_key_path),
            key_passphrase=passphrase
        )

        if self.signer is None:
            raise ValueError(
                "No se pudo cargar la clave de firma. "
                "Verifique que la contraseña sea correcta."
            )

    def add_footer(
        self,
        input_path: Path,
        output_path: Path,
        expiry: date
    ):
        """Agrega la identificación visual de la Biblioteca."""

        text = (
            "Firmado electrónicamente por Biblioteca. "
            f"Vigencia de tres meses, vencimiento: {expiry.isoformat()}"
        )

        document = pymupdf.open(input_path)

        try:
            for page in document:

                page_width = page.rect.width
                page_height = page.rect.height

                # Reduce la letra si el texto no cabe en páginas angostas
                font_size = 9
                max_width = page_width - 40

                while font_size > 5 and pymupdf.get_text_length(
                    text,
                    fontname="helv",
                    fontsize=font_size
                ) > max_width:
                    font_size -= 0.5

                text_width = pymupdf.get_text_length(
                    text,
                    fontname="helv",
                    fontsize=font_size
                )

                x = (page_width - text_width) / 2
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

            expiry = add_months(date.today(), VALIDITY_MONTHS)

            self.add_footer(
                input_path,
                prepared_pdf,
                expiry
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