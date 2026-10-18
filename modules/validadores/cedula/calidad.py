"""Calidad de cada página: resolución (ancho en píxeles) y nitidez (varianza del laplaciano).

Los umbrales son PROVISIONALES: solo hay 2 muestras para calibrar. Por eso la regla que los usa es
informativa (spec 08a, decisión 4).
"""

from dataclasses import dataclass

import cv2
import numpy as np

ANCHO_MINIMO = 1000
NITIDEZ_MINIMA = 100.0


@dataclass(frozen=True)
class Calidad:
    ancho: int
    nitidez: float


def medir(paginas) -> list[Calidad]:
    calidades = []
    for pagina in paginas:
        gris = cv2.cvtColor(np.asarray(pagina.convert("RGB")), cv2.COLOR_RGB2GRAY)
        calidades.append(Calidad(ancho=gris.shape[1], nitidez=float(cv2.Laplacian(gris, cv2.CV_64F).var())))
    return calidades


def es_suficiente(calidad: Calidad) -> bool:
    return calidad.ancho >= ANCHO_MINIMO and calidad.nitidez >= NITIDEZ_MINIMA
