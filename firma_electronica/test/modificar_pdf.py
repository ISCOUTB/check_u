from pathlib import Path

import pymupdf


# ---------------------------------------------------------
# Rutas
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_PDF = (
    BASE_DIR
    / "test"
    / "PAZ Y SALVO BIBLIOTECA firmado.pdf"
)

OUTPUT_PDF = (
    BASE_DIR
    / "test"
    / "PAZ Y SALVO BIBLIOTECA modificado.pdf"
)


# ---------------------------------------------------------
# Abrir el PDF firmado
# ---------------------------------------------------------

document = pymupdf.open(INPUT_PDF)

try:
    # Agregamos una pequeña anotación a la primera página.
    # Esto modifica el documento después de la firma.
    page = document[0]

    page.insert_text(
        (50, 50),
        "MODIFICADO PARA PRUEBA",
        fontsize=12
    )

    # Guardamos como un archivo diferente.
    document.save(
        OUTPUT_PDF
    )

finally:
    document.close()


print("PDF modificado correctamente.")
print()
print(f"PDF firmado:    {INPUT_PDF}")
print(f"PDF modificado: {OUTPUT_PDF}")