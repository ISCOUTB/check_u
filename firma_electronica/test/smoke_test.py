import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config.paths import find_cert_dir
from app.signature_service import SignatureService
from pyhanko.keys import load_cert_from_pemder
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko_certvalidator import ValidationContext

SAMPLE = ROOT / "test" / "samples" / "PAZ Y SALVO BIBLIOTECA.pdf"


def check(name, ok):
    print(f"[{'OK' if ok else 'FALLO'}] {name}")
    if not ok:
        sys.exit(1)


# 1. Encuentra los certificados
cert_dir = find_cert_dir()
check(f"Certificados encontrados en {cert_dir}", True)

# 2. Firma una copia del PDF
with tempfile.TemporaryDirectory() as tmp:
    pdf = Path(tmp) / "prueba.pdf"
    shutil.copy(SAMPLE, pdf)

    # Ponle aquí la contraseña si ya cifraste la clave
    signed = SignatureService().sign_document(pdf, passphrase="bibliotecha2026")
    check("Se generó el PDF firmado", signed.exists())

    # 3. Valida la firma
    root_cert = load_cert_from_pemder(str(cert_dir / "biblioteca.crt"))
    vc = ValidationContext(trust_roots=[root_cert])

    with open(signed, "rb") as f:
        reader = PdfFileReader(f)
        sigs = reader.embedded_signatures
        check("El PDF tiene una firma", len(sigs) == 1)
        status = validate_pdf_signature(sigs[0], vc)
        print(status.pretty_print_details())
        check("Firma íntegra", status.intact)
        check("Firma válida", status.valid)

    # 4. Detecta modificaciones: cambia un byte dentro del contenido firmado
    data = bytearray(signed.read_bytes())
    data[200] ^= 0xFF
    tampered = Path(tmp) / "alterado.pdf"
    tampered.write_bytes(bytes(data))
    try:
        with open(tampered, "rb") as f:
            st = validate_pdf_signature(PdfFileReader(f).embedded_signatures[0], vc)
            check("Detecta PDF alterado", not (st.intact and st.valid))
    except Exception:
        check("Detecta PDF alterado (el lector lo rechazó)", True)

# 5. Sin certificados debe fallar con mensaje claro
os.environ["FIRMA_CERT_DIR"] = str(Path(tempfile.gettempdir()) / "no_existe")
backup = {}
try:
    # Oculta secrets temporalmente para simular un equipo no autorizado
    secrets = ROOT / "secrets"
    hidden = ROOT / "secrets_oculto"
    secrets.rename(hidden)
    try:
        find_cert_dir()
        check("Falla sin certificados", False)
    except FileNotFoundError as e:
        check("Falla sin certificados con mensaje claro", True)
    finally:
        hidden.rename(secrets)
finally:
    os.environ.pop("FIRMA_CERT_DIR", None)

print("\nTodo correcto.")