from pathlib import Path

from infra.sign_validator import SignatureValidator


# ---------------------------------------------------------
# Rutas
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

SIGNED_PDF = (
    BASE_DIR
    / "test"
    / "PAZ Y SALVO BIBLIOTECA firmado.pdf"
)

MODIFIED_PDF = (
    BASE_DIR
    / "test"
    / "PAZ Y SALVO BIBLIOTECA modificado.pdf"
)


# ---------------------------------------------------------
# Crear validador
# ---------------------------------------------------------

validator = SignatureValidator()


# ---------------------------------------------------------
# Función para mostrar resultado
# ---------------------------------------------------------

def validate_and_show(
    title: str,
    pdf_path: Path
):

    print()
    print("=" * 60)
    print(title)
    print("=" * 60)

    print(f"Archivo: {pdf_path.name}")

    if not pdf_path.exists():
        print("ERROR: El archivo no existe.")
        return

    try:

        result = validator.validate(
            pdf_path
        )

        print()
        print(f"Firma válida:     {result['valid']}")
        print(f"Documento alterado: {result['modified']}")
        print(f"Mensaje:          {result['message']}")

    except Exception as error:

        print()
        print("ERROR DURANTE LA VALIDACIÓN")
        print(error)


# ---------------------------------------------------------
# Prueba 1: PDF firmado
# ---------------------------------------------------------

validate_and_show(
    "PRUEBA 1 - PDF FIRMADO",
    SIGNED_PDF
)


# ---------------------------------------------------------
# Prueba 2: PDF modificado
# ---------------------------------------------------------

validate_and_show(
    "PRUEBA 2 - PDF MODIFICADO",
    MODIFIED_PDF
)