import getpass
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


# Carpeta de salida: secrets\ en la raíz del proyecto
CERT_DIR = Path(__file__).resolve().parent.parent / "secrets"
CERT_DIR.mkdir(exist_ok=True)

private_key_path = CERT_DIR / "biblioteca.key"
certificate_path = CERT_DIR / "biblioteca.crt"

# Evita sobrescribir una clave existente por accidente
if private_key_path.exists() or certificate_path.exists():
    print("Ya existen biblioteca.key o biblioteca.crt en:")
    print(f"  {CERT_DIR}")
    print("Muévelos a un lugar seguro o bórralos antes de generar otros.")
    sys.exit(1)


# ---------------------------------------------------------
# 1. Pedir la contraseña (no se muestra al escribir)
# ---------------------------------------------------------

password = getpass.getpass("Contraseña para proteger la clave: ")
confirm = getpass.getpass("Repita la contraseña: ")

if password != confirm:
    print("Las contraseñas no coinciden.")
    sys.exit(1)

if len(password) < 12:
    print("Use una contraseña de al menos 12 caracteres.")
    sys.exit(1)


# ---------------------------------------------------------
# 2. Crear la clave privada
# ---------------------------------------------------------

private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=3072
)


# ---------------------------------------------------------
# 3. Información del certificado
# ---------------------------------------------------------

subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, "CO"),
    x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Bolivar"),
    x509.NameAttribute(NameOID.LOCALITY_NAME, "Cartagena"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Biblioteca"),
    x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Firma Electronica"),
    x509.NameAttribute(NameOID.COMMON_NAME, "Biblioteca"),
])


# ---------------------------------------------------------
# 4. Crear el certificado
# ---------------------------------------------------------

now = datetime.now(timezone.utc)
valid_until = now + timedelta(days=365 * 3)

certificate = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(private_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now)
    .not_valid_after(valid_until)
    .add_extension(
        x509.BasicConstraints(ca=True, path_length=None),
        critical=True
    )
    .add_extension(
        x509.KeyUsage(
            digital_signature=True,
            content_commitment=True,   # no repudio
            key_encipherment=False,
            data_encipherment=False,
            key_agreement=False,
            key_cert_sign=True,
            crl_sign=False,
            encipher_only=False,
            decipher_only=False,
        ),
        critical=True
    )
    .sign(private_key, hashes.SHA256())
)


# ---------------------------------------------------------
# 5. Guardar la clave privada CIFRADA
# ---------------------------------------------------------

with open(private_key_path, "wb") as file:
    file.write(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.BestAvailableEncryption(
                password.encode("utf-8")
            ),
        )
    )


# ---------------------------------------------------------
# 6. Guardar el certificado (público)
# ---------------------------------------------------------

with open(certificate_path, "wb") as file:
    file.write(certificate.public_bytes(serialization.Encoding.PEM))


# ---------------------------------------------------------
# 7. Resumen y huella para registrar en CheckU
# ---------------------------------------------------------

fingerprint = certificate.fingerprint(hashes.SHA256()).hex()

print()
print("Certificado creado correctamente.")
print(f"Clave privada (cifrada): {private_key_path}")
print(f"Certificado:             {certificate_path}")
print(f"Válido hasta:            {valid_until.date()}")
print(f"Huella SHA-256:          {fingerprint}")
print()
print("Guarde la contraseña en un gestor de contraseñas: si se pierde,")
print("la clave no se puede recuperar.")