from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


# Directorio donde guardaremos el certificado
CERT_DIR = Path(__file__).parent.parent / "certificados"
CERT_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------
# 1. Crear la clave privada
# ---------------------------------------------------------

private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)


# ---------------------------------------------------------
# 2. Información del certificado
# ---------------------------------------------------------

subject = issuer = x509.Name([
    x509.NameAttribute(
        NameOID.COUNTRY_NAME,
        "CO"
    ),
    x509.NameAttribute(
        NameOID.STATE_OR_PROVINCE_NAME,
        "Bolivar"
    ),
    x509.NameAttribute(
        NameOID.LOCALITY_NAME,
        "Cartagena"
    ),
    x509.NameAttribute(
        NameOID.ORGANIZATION_NAME,
        "Biblioteca"
    ),
    x509.NameAttribute(
        NameOID.ORGANIZATIONAL_UNIT_NAME,
        "Firma Electronica"
    ),
    x509.NameAttribute(
        NameOID.COMMON_NAME,
        "Biblioteca"
    )
])


# ---------------------------------------------------------
# 3. Crear el certificado
# ---------------------------------------------------------

now = datetime.now(timezone.utc)

certificate = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(private_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now)
    .not_valid_after(now + timedelta(days=365))
    .add_extension(
        x509.BasicConstraints(
            ca=True,
            path_length=None
        ),
        critical=True
    )
    .sign(
        private_key,
        hashes.SHA256()
    )
)


# ---------------------------------------------------------
# 4. Guardar clave privada
# ---------------------------------------------------------

private_key_path = CERT_DIR / "biblioteca.key"

with open(private_key_path, "wb") as file:
    file.write(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        )
    )


# ---------------------------------------------------------
# 5. Guardar certificado
# ---------------------------------------------------------

certificate_path = CERT_DIR / "biblioteca.crt"

with open(certificate_path, "wb") as file:
    file.write(
        certificate.public_bytes(
            serialization.Encoding.PEM
        )
    )


print("Certificado creado correctamente.")
print()
print(f"Clave privada: {private_key_path}")
print(f"Certificado:   {certificate_path}")