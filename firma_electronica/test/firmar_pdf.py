from pathlib import Path
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers


# ---------------------------------------------------------
# Rutas
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

CERTIFICATE_PATH = (
    BASE_DIR
    / "certificados"
    / "biblioteca.crt"
)

PRIVATE_KEY_PATH = (
    BASE_DIR
    / "certificados"
    / "biblioteca.key"
)

INPUT_PDF = (
    BASE_DIR
    / "test"
    / "PAZ Y SALVO BIBLIOTECA.pdf"
)

OUTPUT_PDF = (
    BASE_DIR
    / "test"
    / "PAZ Y SALVO BIBLIOTECA firmado.pdf"
)


# ---------------------------------------------------------
# Crear firmante
# ---------------------------------------------------------

signer = signers.SimpleSigner.load(
    cert_file=str(CERTIFICATE_PATH),
    key_file=str(PRIVATE_KEY_PATH)
)


# ---------------------------------------------------------
# Abrir PDF
# ---------------------------------------------------------

with open(INPUT_PDF, "rb") as input_file:

    writer = IncrementalPdfFileWriter(
        input_file,
        strict=False
    )

    signature_meta = signers.PdfSignatureMetadata(
        field_name="FirmaBiblioteca",
        reason="Documento firmado por la Biblioteca"
    )

    pdf_signer = signers.PdfSigner(
        signature_meta,
        signer=signer
    )

    with open(OUTPUT_PDF, "wb") as output_file:

        pdf_signer.sign_pdf(
            writer,
            output=output_file
        )


print("PDF firmado correctamente.")
print()
print(f"Original: {INPUT_PDF}")
print(f"Firmado:  {OUTPUT_PDF}")