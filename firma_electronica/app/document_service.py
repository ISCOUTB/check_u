from pathlib import Path

from domain.document import Document
from infra.file_system import FileSystem


class DocumentService:
    """Contiene la lógica relacionada con los documentos."""

    def __init__(self):
        self.file_system = FileSystem()

    def list_documents(self, directory: str) -> list[Document]:
        pdf_files = self.file_system.list_pdf_files(directory)

        return [
            Document(
                name=file.name,
                path=file
            )
            for file in pdf_files
        ]