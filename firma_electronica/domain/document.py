from dataclasses import dataclass
from pathlib import Path


@dataclass
class Document:
    """Representa un documento PDF."""

    name: str
    path: Path

    @property
    def extension(self) -> str:
        return self.path.suffix.lower()