import pymupdf


class PDFHandler:
    """Gestiona las operaciones relacionadas con archivos PDF."""

    @staticmethod
    def get_page_sizes(pdf_path: str):
        """
        Obtiene las dimensiones de todas las páginas
        sin renderizar sus imágenes.
        """

        document = pymupdf.open(pdf_path)

        try:
            if len(document) == 0:
                raise ValueError("El PDF no contiene páginas.")

            return [
                (
                    page.rect.width,
                    page.rect.height
                )
                for page in document
            ]

        finally:
            document.close()

    @staticmethod
    def render_pages(
        pdf_path: str,
        page_width: float
    ):
        """
        Renderiza todas las páginas utilizando el ancho
        indicado. Esto evita generar imágenes demasiado grandes.
        """

        document = pymupdf.open(pdf_path)

        try:
            if len(document) == 0:
                raise ValueError("El PDF no contiene páginas.")

            pages = []

            for page in document:

                original_width = page.rect.width

                # Calculamos el factor necesario para que
                # la página tenga el ancho solicitado.
                scale = page_width / original_width

                matrix = pymupdf.Matrix(
                    scale,
                    scale
                )

                pixmap = page.get_pixmap(
                    matrix=matrix,
                    alpha=False
                )

                pages.append(
                    pixmap.tobytes("png")
                )

            return pages

        finally:
            document.close()