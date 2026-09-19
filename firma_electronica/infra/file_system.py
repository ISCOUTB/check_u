from pathlib import Path


class FileSystem:
    """Gestiona el acceso a archivos y directorios."""

    @staticmethod
    def list_pdf_files(directory: str) -> list[Path]:
        path = Path(directory)

        if not path.exists():
            raise FileNotFoundError("El directorio seleccionado no existe.")

        if not path.is_dir():
            raise NotADirectoryError("La ruta seleccionada no es un directorio.")

        return sorted(
            file for file in path.iterdir()
            if file.is_file() and file.suffix.lower() == ".pdf"
        )