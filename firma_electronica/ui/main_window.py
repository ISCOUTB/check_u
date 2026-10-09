import tkinter as tk
from tkinter import filedialog, messagebox, ttk, simpledialog
from datetime import datetime
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageTk
from app.document_service import DocumentService
from config.paths import asset_path
from infra.pdf_handler import PDFHandler
from app.signature_service import SignatureService


# ==========================================================
# PALETA DE COLORES
# ==========================================================

COLORS = {
    "bg": "#FFFFFF",            # fondo general de la ventana
    "surface": "#FFFFFF",       # fondo de tarjetas / marcos
    "border": "#E1E5EA",        # bordes suaves
    "primary": "#2F6FED",       # azul principal (acciones)
    "primary_hover": "#2559C7",
    "primary_disabled": "#A9C1F5",
    "text": "#1F2937",          # texto principal
    "text_muted": "#6B7280",    # texto secundario
    "canvas_bg": "#E9ECF1",     # fondo del visor
    "page_bg": "#FFFFFF",
    "page_border": "#D3D8E0",
    "selection": "#EAF1FF",
}

FONT_FAMILY = "Segoe UI"


# ==========================================================
# UTILIDADES
# ==========================================================

def format_size(num_bytes: int) -> str:
    """Convierte bytes a la unidad más legible (B, KB, MB, GB, TB, PB)."""
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    size = float(num_bytes)

    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(size)} B"
            return f"{size:.1f} {unit}"
        size /= 1024


def get_file_info(path) -> tuple[datetime, int]:
    """Devuelve (fecha de creación, tamaño en bytes)."""
    stat = Path(path).stat()
    created = getattr(stat, "st_birthtime", stat.st_ctime)
    return datetime.fromtimestamp(created), stat.st_size


def create_pdf_icon(size: int = 24) -> Image.Image:
    """Dibuja un icono de documento PDF (se dibuja grande y se reduce
    para que quede suave)."""
    scale = 8
    s = size * scale
    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    red = (220, 53, 69, 255)
    left, top = int(s * 0.16), int(s * 0.04)
    right, bottom = int(s * 0.84), int(s * 0.96)
    fold = int(s * 0.24)

    # Hoja con esquina doblada
    draw.polygon(
        [(left, top), (right - fold, top), (right, top + fold),
         (right, bottom), (left, bottom)],
        fill=(255, 255, 255, 255), outline=red, width=scale
    )
    draw.polygon(
        [(right - fold, top), (right - fold, top + fold), (right, top + fold)],
        fill=(250, 215, 218, 255), outline=red
    )

    # Franja roja con el texto PDF
    band_top, band_bottom = int(s * 0.52), int(s * 0.80)
    draw.rectangle([left, band_top, right, band_bottom], fill=red)

    for font_name in ("arialbd.ttf", "segoeuib.ttf"):
        try:
            font = ImageFont.truetype(font_name, int(s * 0.2))
        except OSError:
            continue
        draw.text(
            ((left + right) / 2, (band_top + band_bottom) / 2),
            "PDF", fill="white", font=font, anchor="mm"
        )
        break

    return image.resize((size, size), Image.LANCZOS)


def load_logo(filename: str, height: int):
    """Carga un logo escalado a una altura fija. None si no existe."""
    path = asset_path(filename)
    if not path.exists():
        return None

    image = Image.open(path).convert("RGBA")
    ratio = height / image.height
    image = image.resize(
        (max(1, int(image.width * ratio)), height), Image.LANCZOS
    )
    return ImageTk.PhotoImage(image)


class SignatureApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Firma electrónica - Biblioteca")
        self.root.geometry("1280x760")
        self.root.minsize(1050, 640)
        self.root.configure(background=COLORS["bg"])

        self.document_service = DocumentService()
        self.pdf_handler = PDFHandler()
        self.signature_service = SignatureService()
        self.documents = []
        self.selected_document = None

        # Imágenes actualmente renderizadas
        self.preview_images = []

        # Zoom relativo al ancho del visor
        self.zoom = 1.0

        # Evita renderizados repetidos innecesarios
        self.last_render_width = None

        # Icono de PDF y logos (hay que guardar la referencia o Tk los borra).
        # Deben crearse ANTES de create_interface().
        self.pdf_icon = ImageTk.PhotoImage(create_pdf_icon(24))
        self.university_logo = load_logo("logo_utb.png", 56)
        self.checku_logo = load_logo("checku_logo.png", 56)

        # Datos de cada fila de la lista y estado del ordenamiento
        self.document_meta = {}
        self.sort_state = {}

        # Para no re-renderizar en cada píxel al mover el divisor
        self._resize_job = None

        self.configure_styles()
        self.create_interface()

    # ======================================================
    # ESTILOS
    # ======================================================

    def configure_styles(self):
        style = ttk.Style()

        # 'clam' es el único tema base que permite personalizar
        # colores de fondo/relleno de botones y marcos de forma confiable.
        style.theme_use("clam")

        style.configure(
            ".",
            background=COLORS["bg"],
            foreground=COLORS["text"],
            font=(FONT_FAMILY, 10)
        )

        # ---------------- Encabezado ----------------

        style.configure(
            "Title.TLabel",
            font=(FONT_FAMILY, 19, "bold"),
            foreground=COLORS["text"],
            background=COLORS["bg"]
        )

        style.configure(
            "Subtitle.TLabel",
            font=(FONT_FAMILY, 10),
            foreground=COLORS["text_muted"],
            background=COLORS["bg"]
        )

        # ---------------- Marcos con título ----------------

        style.configure(
            "Section.TLabelframe",
            background=COLORS["surface"],
            bordercolor=COLORS["border"],
            borderwidth=1,
            relief="solid",
            padding=14
        )

        style.configure(
            "Section.TLabelframe.Label",
            font=(FONT_FAMILY, 11, "bold"),
            foreground=COLORS["text"],
            background=COLORS["surface"]
        )

        style.configure(
            "TFrame",
            background=COLORS["bg"]
        )

        style.configure(
            "Surface.TFrame",
            background=COLORS["surface"]
        )

        # ---------------- Botón principal (acción) ----------------

        style.configure(
            "Action.TButton",
            font=(FONT_FAMILY, 11, "bold"),
            padding=(22, 11),
            background=COLORS["primary"],
            foreground="#FFFFFF",
            borderwidth=0,
            focuscolor=COLORS["primary"]
        )

        style.map(
            "Action.TButton",
            background=[
                ("disabled", COLORS["primary_disabled"]),
                ("pressed", COLORS["primary_hover"]),
                ("active", COLORS["primary_hover"])
            ],
            foreground=[
                ("disabled", "#F0F3FC")
            ]
        )

        # ---------------- Botones secundarios ----------------

        style.configure(
            "Secondary.TButton",
            font=(FONT_FAMILY, 10),
            padding=(14, 7),
            background=COLORS["surface"],
            foreground=COLORS["text"],
            borderwidth=1,
            bordercolor=COLORS["border"],
            relief="solid"
        )

        style.map(
            "Secondary.TButton",
            background=[
                ("pressed", COLORS["selection"]),
                ("active", COLORS["selection"])
            ]
        )

        # ---------------- Botones de zoom (compactos) ----------------

        style.configure(
            "Zoom.TButton",
            font=(FONT_FAMILY, 11, "bold"),
            padding=(6, 4),
            background=COLORS["surface"],
            foreground=COLORS["text"],
            borderwidth=1,
            bordercolor=COLORS["border"],
            relief="solid"
        )

        style.map(
            "Zoom.TButton",
            background=[
                ("pressed", COLORS["selection"]),
                ("active", COLORS["selection"])
            ]
        )

        style.configure(
            "ZoomLabel.TLabel",
            font=(FONT_FAMILY, 10, "bold"),
            foreground=COLORS["text_muted"],
            background=COLORS["surface"]
        )

        # ---------------- Etiquetas informativas ----------------

        style.configure(
            "Muted.TLabel",
            font=(FONT_FAMILY, 10),
            foreground=COLORS["text_muted"],
            background=COLORS["surface"]
        )

        style.configure(
            "Path.TLabel",
            font=(FONT_FAMILY, 10),
            foreground=COLORS["text"],
            background=COLORS["surface"]
        )

        style.configure(
            "SelectedDoc.TLabel",
            font=(FONT_FAMILY, 11, "bold"),
            foreground=COLORS["text"],
            background=COLORS["surface"]
        )

        # ---------------- Scrollbars ----------------

        style.configure(
            "TScrollbar",
            background=COLORS["surface"],
            troughcolor=COLORS["bg"],
            bordercolor=COLORS["border"],
            arrowcolor=COLORS["text_muted"]
        )

        # ---------------- Lista de documentos ----------------

        style.configure(
            "Documents.Treeview",
            background=COLORS["surface"],
            fieldbackground=COLORS["surface"],
            foreground=COLORS["text"],
            font=(FONT_FAMILY, 10),
            rowheight=36,
            borderwidth=0
        )

        style.layout(
            "Documents.Treeview",
            [("Treeview.treearea", {"sticky": "nswe"})]
        )

        style.map(
            "Documents.Treeview",
            background=[("selected", COLORS["selection"])],
            foreground=[("selected", COLORS["text"])]
        )

        style.configure(
            "Documents.Treeview.Heading",
            background=COLORS["bg"],
            foreground=COLORS["text_muted"],
            font=(FONT_FAMILY, 10, "bold"),
            relief="flat",
            padding=(8, 6)
        )

        style.map(
            "Documents.Treeview.Heading",
            background=[("active", COLORS["selection"])]
        )

    def create_interface(self):
        # ==================================================
        # CONFIGURACIÓN PRINCIPAL
        # ==================================================

        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(2, weight=1)

        # ==================================================
        # ENCABEZADO
        # ==================================================

        header_frame = ttk.Frame(self.root)
        header_frame.grid(
            row=0, column=0, sticky="ew", padx=28, pady=(24, 12)
        )
        header_frame.columnconfigure(0, weight=1)

        text_frame = ttk.Frame(header_frame)
        text_frame.grid(row=0, column=0, sticky="w")

        title = ttk.Label(
            text_frame,
            text="Firma electrónica de documentos",
            style="Title.TLabel"
        )
        title.pack(anchor="w")

        subtitle = ttk.Label(
            text_frame,
            text="Seleccione un directorio y el documento que desea firmar.",
            style="Subtitle.TLabel"
        )
        subtitle.pack(anchor="w", pady=(4, 0))

        # Logos en la esquina derecha
        logos_frame = ttk.Frame(header_frame)
        logos_frame.grid(row=0, column=1, sticky="e")

        for logo in (self.university_logo, self.checku_logo):
            if logo is not None:
                ttk.Label(logos_frame, image=logo).pack(
                    side="left", padx=(18, 0)
                )

        # ==================================================
        # DIRECTORIO
        # ==================================================

        directory_frame = ttk.Labelframe(
            self.root,
            text="Directorio de documentos",
            style="Section.TLabelframe"
        )
        directory_frame.grid(
            row=1,
            column=0,
            sticky="ew",
            padx=28,
            pady=8
        )

        directory_frame.columnconfigure(1, weight=1)

        select_button = ttk.Button(
            directory_frame,
            text="Seleccionar directorio",
            style="Secondary.TButton",
            command=self.select_directory
        )
        select_button.grid(
            row=0,
            column=0,
            padx=(0, 15),
            sticky="w"
        )

        self.directory_label = ttk.Label(
            directory_frame,
            text="Ningún directorio seleccionado",
            style="Muted.TLabel"
        )
        self.directory_label.grid(
            row=0,
            column=1,
            sticky="ew"
        )

        # ==================================================
        # CONTENIDO PRINCIPAL
        # ==================================================

        content_frame = ttk.Frame(self.root)
        content_frame.grid(row=2, column=0, sticky="nsew", padx=28, pady=8)

        content_frame.columnconfigure(0, weight=1)
        content_frame.rowconfigure(0, weight=1)

        # Divisor arrastrable entre lista y previsualización
        self.paned = tk.PanedWindow(
            content_frame,
            orient="horizontal",
            sashwidth=6,
            sashrelief="flat",
            sashpad=0,
            borderwidth=0,
            background=COLORS["border"],
            sashcursor="sb_h_double_arrow",
            opaqueresize=True
        )
        self.paned.grid(row=0, column=0, sticky="nsew")

        # ==================================================
        # DOCUMENTOS
        # ==================================================

        documents_frame = ttk.Labelframe(
            self.paned,
            text="Documentos disponibles",
            style="Section.TLabelframe",
            cursor="arrow"
        )
        documents_frame.columnconfigure(0, weight=1)
        documents_frame.rowconfigure(0, weight=1)

        list_frame = ttk.Frame(documents_frame, style="Surface.TFrame")
        list_frame.grid(row=0, column=0, sticky="nsew")
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)

        self.document_tree = ttk.Treeview(
            list_frame,
            columns=("created", "size"),
            style="Documents.Treeview",
            selectmode="browse"
        )

        self.document_tree.heading(
            "#0", text="Nombre", anchor="w",
            command=lambda: self.sort_documents("name")
        )
        self.document_tree.heading(
            "created", text="Fecha de creación", anchor="w",
            command=lambda: self.sort_documents("created")
        )
        self.document_tree.heading(
            "size", text="Tamaño", anchor="e",
            command=lambda: self.sort_documents("size")
        )

        self.document_tree.column(
            "#0", width=280, minwidth=160, stretch=True
        )
        self.document_tree.column(
            "created", width=150, minwidth=130, stretch=False, anchor="w"
        )
        self.document_tree.column(
            "size", width=90, minwidth=70, stretch=False, anchor="e"
        )

        self.document_tree.grid(row=0, column=0, sticky="nsew")

        list_scrollbar = ttk.Scrollbar(
            list_frame,
            orient="vertical",
            command=self.document_tree.yview
        )
        list_scrollbar.grid(row=0, column=1, sticky="ns")

        self.document_tree.configure(yscrollcommand=list_scrollbar.set)
        self.document_tree.bind("<<TreeviewSelect>>", self.select_document)
        # Evita redimensionar las columnas arrastrando el encabezado
        for sequence in ("<Button-1>", "<B1-Motion>", "<Motion>"):
            self.document_tree.bind(sequence, self.block_column_resize)
        # ==================================================
        # PREVISUALIZACIÓN
        # ==================================================

        preview_frame = ttk.Labelframe(
            self.paned,
            text="Previsualización del documento",
            style="Section.TLabelframe",
            cursor="arrow"
        )
        preview_frame.columnconfigure(0, weight=1)
        preview_frame.rowconfigure(1, weight=1)

        self.paned.add(documents_frame, minsize=420, stretch="always")
        self.paned.add(preview_frame, minsize=300, stretch="always")

        # La lista ocupa ~62 % y la previsualización el resto
        self.root.after(150, self.set_initial_sash)

        # ==================================================
        # CONTROLES DE ZOOM
        # ==================================================

        zoom_frame = ttk.Frame(preview_frame, style="Surface.TFrame")

        zoom_frame.grid(
            row=0,
            column=0,
            sticky="ew",
            pady=(0, 10)
        )

        zoom_minus_button = ttk.Button(
            zoom_frame,
            text="−",
            width=3,
            style="Zoom.TButton",
            command=self.zoom_out
        )
        zoom_minus_button.pack(
            side="left",
            padx=(0, 6)
        )

        self.zoom_label = ttk.Label(
            zoom_frame,
            text="100%",
            width=6,
            anchor="center",
            style="ZoomLabel.TLabel"
        )
        self.zoom_label.pack(
            side="left"
        )

        zoom_plus_button = ttk.Button(
            zoom_frame,
            text="+",
            width=3,
            style="Zoom.TButton",
            command=self.zoom_in
        )
        zoom_plus_button.pack(
            side="left",
            padx=6
        )

        reset_zoom_button = ttk.Button(
            zoom_frame,
            text="Restablecer",
            style="Secondary.TButton",
            command=self.reset_zoom
        )
        reset_zoom_button.pack(
            side="left",
            padx=(6, 0)
        )

        # ==================================================
        # VISOR
        # ==================================================

        viewer_frame = ttk.Frame(preview_frame, style="Surface.TFrame")

        viewer_frame.grid(
            row=1,
            column=0,
            sticky="nsew"
        )

        viewer_frame.columnconfigure(0, weight=1)
        viewer_frame.rowconfigure(0, weight=1)

        self.preview_canvas = tk.Canvas(
            viewer_frame,
            background=COLORS["canvas_bg"],
            highlightthickness=1,
            highlightbackground=COLORS["border"]
        )

        self.preview_canvas.grid(
            row=0,
            column=0,
            sticky="nsew"
        )

        vertical_scrollbar = ttk.Scrollbar(
            viewer_frame,
            orient="vertical",
            command=self.preview_canvas.yview
        )

        vertical_scrollbar.grid(
            row=0,
            column=1,
            sticky="ns"
        )

        horizontal_scrollbar = ttk.Scrollbar(
            viewer_frame,
            orient="horizontal",
            command=self.preview_canvas.xview
        )

        horizontal_scrollbar.grid(
            row=1,
            column=0,
            sticky="ew"
        )

        self.preview_canvas.configure(
            xscrollcommand=horizontal_scrollbar.set,
            yscrollcommand=vertical_scrollbar.set
        )

        # ==================================================
        # DOCUMENTO SELECCIONADO
        # ==================================================

        selected_frame = ttk.Labelframe(
            self.root,
            text="Documento seleccionado",
            style="Section.TLabelframe"
        )

        selected_frame.grid(
            row=3,
            column=0,
            sticky="ew",
            padx=28,
            pady=(8, 12)
        )

        self.selected_label = ttk.Label(
            selected_frame,
            text="Ningún documento seleccionado",
            style="SelectedDoc.TLabel"
        )

        self.selected_label.pack(
            anchor="w"
        )

        # ==================================================
        # ACCIONES
        # ==================================================

        action_frame = ttk.Frame(self.root)

        action_frame.grid(
            row=4,
            column=0,
            sticky="ew",
            padx=28,
            pady=(0, 22)
        )

        self.sign_button = ttk.Button(
            action_frame,
            text="Firmar documento",
            style="Action.TButton",
            state="disabled",
            command=self.sign_document
        )

        self.sign_button.pack(
            side="right"
        )

        # Cuando cambia el tamaño del visor,
        # recalculamos el 100 %.
        self.preview_canvas.bind(
            "<Configure>",
            self.on_canvas_resize
        )

    # ======================================================
    # DIVISOR Y LISTA DE DOCUMENTOS
    # ======================================================

    def set_initial_sash(self):
        width = self.paned.winfo_width()

        if width <= 1:
            self.root.after(100, self.set_initial_sash)
            return

        self.paned.sash_place(0, int(width * 0.62), 0)

    def populate_documents(self):
        self.document_tree.delete(*self.document_tree.get_children())
        self.document_meta = {}
        self.sort_state = {}

        for index, document in enumerate(self.documents):
            iid = str(index)

            try:
                created, size = get_file_info(document.path)
                created_text = created.strftime("%d/%m/%Y %H:%M")
            except OSError:
                created, size, created_text = datetime.min, 0, "—"

            self.document_meta[iid] = {
                "name": document.name.lower(),
                "created": created,
                "size": size
            }

            self.document_tree.insert(
                "",
                "end",
                iid=iid,
                text=f"  {document.name}",
                image=self.pdf_icon,
                values=(created_text, format_size(size))
            )

    def sort_documents(self, column):
        """Ordena al hacer clic en el encabezado (clic repetido invierte)."""
        reverse = self.sort_state.get(column, False)

        items = sorted(
            self.document_tree.get_children(""),
            key=lambda iid: self.document_meta[iid][column],
            reverse=reverse
        )

        for position, iid in enumerate(items):
            self.document_tree.move(iid, "", position)

        self.sort_state = {column: not reverse}
    def block_column_resize(self, event):
        """Ignora el arrastre sobre los separadores de columna."""
        if self.document_tree.identify_region(event.x, event.y) == "separator":
            return "break"
    # ======================================================
    # DIRECTORIO
    # ======================================================

    def select_directory(self):
        directory = filedialog.askdirectory(
            title="Seleccionar directorio de Paz y Salvo"
        )

        if not directory:
            return

        try:
            self.documents = self.document_service.list_documents(
                directory
            )

            self.selected_document = None

            self.directory_label.config(
                text=directory
            )

            self.populate_documents()

            self.selected_label.config(
                text="Ningún documento seleccionado"
            )

            self.clear_preview()

            self.sign_button.config(
                state="disabled"
            )

            if not self.documents:
                messagebox.showinfo(
                    "Sin documentos",
                    "El directorio seleccionado no contiene archivos PDF."
                )

        except (
            FileNotFoundError,
            NotADirectoryError
        ) as error:

            messagebox.showerror(
                "Error",
                str(error)
            )

    # ======================================================
    # SELECCIÓN
    # ======================================================

    def select_document(self, event):
        selection = self.document_tree.selection()

        if not selection:
            return

        # El iid es el índice original en self.documents,
        # así que sigue funcionando aunque se ordene la lista.
        self.selected_document = self.documents[int(selection[0])]

        self.selected_label.config(
            text=self.selected_document.name
        )

        self.sign_button.config(
            state="normal"
        )

        # El documento cambió, por lo que debemos
        # invalidar la previsualización anterior.
        self.last_render_width = None
        self.preview_images = []

        self.zoom = 1.0
        self.update_zoom_label()

        # Esperamos un instante para asegurarnos de que
        # el Canvas ya tenga sus dimensiones definitivas.
        self.root.after(
            50,
            self.show_preview
        )

    # ======================================================
    # PREVISUALIZACIÓN
    # ======================================================

    def show_preview(self):
        if self.selected_document is None:
            return

        try:
            viewer_width = self.preview_canvas.winfo_width()

            if viewer_width <= 1:
                self.root.after(
                    50,
                    self.show_preview
                )
                return

            # Margen total de la página.
            margin = 40

            base_width = max(
                300,
                viewer_width - margin
            )

            self.render_document(
                base_width
            )

        except Exception as error:
            self.clear_preview()

            messagebox.showerror(
                "Error de previsualización",
                (
                    "No fue posible visualizar el documento.\n\n"
                    f"{error}"
                )
            )

    # ======================================================
    # RENDERIZAR DOCUMENTO
    # ======================================================

    def render_document(self, base_width):
        if self.selected_document is None:
            return

        # El ancho final depende del zoom.
        target_width = int(
            base_width * self.zoom
        )

        # Evitar renderizar exactamente lo mismo
        # nuevamente.
        if (
            self.last_render_width == target_width
            and self.preview_images
        ):
            self.center_document()

            return

        self.last_render_width = target_width

        pages = self.pdf_handler.render_pages(
            str(self.selected_document.path),
            target_width
        )

        self.preview_images = []

        self.preview_canvas.delete(
            "all"
        )

        y_position = 20
        page_information = []

        for page_data in pages:
            image = Image.open(
                BytesIO(page_data)
            )

            photo = ImageTk.PhotoImage(
                image
            )

            self.preview_images.append(
                photo
            )

            width = image.width
            height = image.height

            page_information.append(
                (
                    photo,
                    width,
                    height,
                    y_position
                )
            )

            y_position += height + 30

        # ==================================================
        # COLOCAR PÁGINAS
        # ==================================================

        viewer_width = self.preview_canvas.winfo_width()

        max_width = 0

        for (
            photo,
            width,
            height,
            y
        ) in page_information:

            if width <= viewer_width:
                x = (
                    viewer_width - width
                ) // 2

            else:
                x = 20

            # Sombra sutil detrás de la página para dar
            # sensación de profundidad sobre el fondo gris.
            shadow_offset = 4

            self.preview_canvas.create_rectangle(
                x - 1 + shadow_offset,
                y - 1 + shadow_offset,
                x + width + 1 + shadow_offset,
                y + height + 1 + shadow_offset,
                fill=COLORS["border"],
                outline=""
            )

            self.preview_canvas.create_rectangle(
                x - 1,
                y - 1,
                x + width + 1,
                y + height + 1,
                fill=COLORS["page_bg"],
                outline=COLORS["page_border"]
            )

            self.preview_canvas.create_image(
                x,
                y,
                image=photo,
                anchor="nw"
            )

            max_width = max(
                max_width,
                x + width
            )

        total_height = y_position

        self.preview_canvas.configure(
            scrollregion=(
                0,
                0,
                max(
                    viewer_width,
                    max_width + 20
                ),
                total_height
            )
        )

        self.preview_canvas.xview_moveto(0)
        self.preview_canvas.yview_moveto(0)

    # ======================================================
    # ZOOM
    # ======================================================

    def zoom_in(self):
        if self.selected_document is None:
            return

        if self.zoom >= 3.0:
            return

        self.zoom += 0.25

        self.update_zoom_label()

        self.render_from_current_view()

    def zoom_out(self):
        if self.selected_document is None:
            return

        if self.zoom <= 0.5:
            return

        self.zoom -= 0.25

        self.update_zoom_label()

        self.render_from_current_view()

    def reset_zoom(self):
        if self.selected_document is None:
            return

        self.zoom = 1.0

        self.update_zoom_label()

        self.last_render_width = None

        self.show_preview()

    def render_from_current_view(self):
        viewer_width = self.preview_canvas.winfo_width()

        if viewer_width <= 1:
            return

        margin = 40

        base_width = max(
            300,
            viewer_width - margin
        )

        self.render_document(
            base_width
        )

    def update_zoom_label(self):
        percentage = int(
            self.zoom * 100
        )

        self.zoom_label.config(
            text=f"{percentage}%"
        )

    # ======================================================
    # CAMBIO DE TAMAÑO DEL VISOR
    # ======================================================

    def on_canvas_resize(self, event=None):
        if self.selected_document is None:
            self.center_placeholder()
            return

        # Si estamos en 100 %, el documento debe seguir
        # ajustándose al ancho del visor. Se espera a que
        # termine el arrastre del divisor antes de renderizar.
        if self.zoom == 1.0:
            if self._resize_job is not None:
                self.root.after_cancel(self._resize_job)

            self._resize_job = self.root.after(150, self._apply_resize)

    def _apply_resize(self):
        self._resize_job = None
        self.last_render_width = None
        self.show_preview()

    # ======================================================
    # CENTRAR
    # ======================================================

    def center_document(self):
        self.preview_canvas.xview_moveto(0)
        self.preview_canvas.yview_moveto(0)

    # ======================================================
    # LIMPIAR
    # ======================================================

    def clear_preview(self):
        self.preview_canvas.delete(
            "all"
        )

        self.preview_images = []
        self.last_render_width = None

        self.preview_canvas.configure(
            scrollregion=(0, 0, 0, 0)
        )

        self.zoom = 1.0

        self.update_zoom_label()

        self.preview_canvas.create_text(
            0,
            0,
            text="Seleccione un documento para visualizarlo.",
            anchor="center",
            fill=COLORS["text_muted"],
            font=(FONT_FAMILY, 11),
            tags="placeholder"
        )

        self.center_placeholder()

    def center_placeholder(self):
        width = self.preview_canvas.winfo_width()
        height = self.preview_canvas.winfo_height()

        if width > 1 and height > 1:
            self.preview_canvas.coords(
                "placeholder",
                width // 2,
                height // 2
            )

    # ======================================================
    # FIRMA
    # ======================================================

    def sign_document(self):

        if self.selected_document is None:
            messagebox.showwarning(
                "Documento no seleccionado",
                "Selecciona un documento antes de firmar."
            )
            return

        passphrase = simpledialog.askstring(
            "Contraseña de firma",
            "Ingrese la contraseña de la clave de la biblioteca:",
            show="*",
            parent=self.root
        )

        if passphrase is None:  # el usuario canceló
            return

        try:
            signed_path = self.signature_service.sign_document(
                self.selected_document.path,
                passphrase
            )

            messagebox.showinfo(
                "Firma completada",
                (
                    "El documento fue firmado correctamente.\n\n"
                    f"Archivo generado:\n{signed_path.name}"
                )
            )

        except Exception as error:

            messagebox.showerror(
                "Error de firma",
                (
                    "No fue posible firmar el documento.\n\n"
                    f"{error}"
                )
            )