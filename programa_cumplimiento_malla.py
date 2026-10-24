#!/usr/bin/env python
"""Acceso directo para ejecutar el programa de análisis de cumplimiento de la malla curricular (Tarea 27).

Uso:
    python programa_cumplimiento_malla.py <ruta_a_evaluacion.pdf>
    python -m modules.malla_curricular <ruta_a_evaluacion.pdf>
"""

import sys
from modules.malla_curricular.__main__ import main

if __name__ == "__main__":
    sys.exit(main())
