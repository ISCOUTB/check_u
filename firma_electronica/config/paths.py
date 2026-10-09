import os
import sys
from pathlib import Path

APP_NAME = "FirmaBiblioteca"

def _candidates():
    env = os.environ.get("FIRMA_CERT_DIR")
    if env:
        yield Path(env)
    program_data = os.environ.get("PROGRAMDATA")
    if program_data:
        yield Path(program_data) / APP_NAME / "certificados"
    if getattr(sys, "frozen", False):
        yield Path(sys.executable).parent / "certificados"
    else:
        yield Path(__file__).resolve().parent.parent / "secrets"

def find_cert_dir() -> Path:
    for path in _candidates():
        if (path / "biblioteca.key").exists() and (path / "biblioteca.crt").exists():
            return path
    raise FileNotFoundError(
        "No se encontraron los certificados de la biblioteca en este equipo.\n"
        "Contacte al administrador."
    )
def asset_path(name: str) -> Path:
    """Ruta a un recurso (logos), en desarrollo y compilado."""
    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    else:
        base = Path(__file__).resolve().parent.parent
    return base / "assets" / name