"""Fixtures y datos de prueba anonimizados para estampilla Pro-Cultura (Tarea 22)."""

from __future__ import annotations

import pytest

HTML_PAGADO_VALIDO = """<div class="container col-lg-10" id="liquidaciones-content">
    <div class="row align-items-center justify-content-center">

        <div class="col-lg-9 col-md-10 col-sm-12">
            <div class="card">

                <div class="card-header border-0 py-3 text-left">
                    <h6>Certificación De Pago Recibo:
                        0012345678
                        <span class="text-uppercase badge badge-success text-light my-auto mx-3">
                            Pagado
                        </span>
                    </h6>
                </div>

                <div class="card-body pt-0">
                    <div class="">
                        <div class="row justify-content-center">
                            <div class="row col-sm-11 col-md-9 justify-content-between">
                                <label class="">Recibo Oficial:
                                </label>
                                <span>0012345678</span>
                            </div>
                            <div class="row col-sm-11 col-md-9 justify-content-between">
                                <label class="">Contribuyente:
                                </label>
                                <span>100****** - ESTUDIANTE ANONIMO PRUEBA</span>
                            </div>
                            <div class="row col-sm-11 col-md-9 justify-content-between">
                                <label class="font-bold">Fecha De Pago:
                                </label>
                                <span class="font-bold">2026-10-13</span>
                            </div>
                            <div class="row col-sm-11 col-md-9 justify-content-between">
                                <label class="">Entidad Recaudadora:
                                </label>
                                <span class="">77 - Pse Gou</span>
                            </div>
                            <div class="row col-sm-11 col-md-9 justify-content-between">
                                <label class="">Renta: </label>
                                <span class="">165 - Estampilla Departamental</span>
                            </div>
                            <div class="row col-sm-11 col-md-9 justify-content-between">
                                <label class="font-bold">Valor Base Liquidación:
                                </label>
                                <span class="font-bold">$ 0</span>
                            </div>
                            <br>

                            <div class="row col-12">
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th class="py-3 text-left">
                                                    Renta
                                                </th>
                                                <th class="py-3 text-left">
                                                    Conceptos Liquidados
                                                </th>

                                                <th class="py-3 text-right">
                                                    Valor
                                                </th>
                                                <th class="py-3 text-right">
                                                    Estado
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>

                                            <tr>
                                                <td class="py-1 text-left text-sm">
                                                    165 - EXPEDICIÓN TÍTULOS DE TÉCNICOS
                                                </td>
                                                <td class="py-1 text-left text-sm">
                                                    Estampilla Pro-Cultura
                                                </td>

                                                <td class="py-1 text-right text-sm">
                                                    $ 70,036
                                                </td>
                                                <td class="py-1 text-right text-sm">Pagado
                                                </td>
                                            </tr>

                                            <tr>
                                                <td class="py-1 text-left text-sm">
                                                    165 - EXPEDICIÓN TÍTULOS DE TÉCNICOS
                                                </td>
                                                <td class="py-1 text-left text-sm">
                                                    Estampilla Prodesarrollo (Liquidacion Recibo)
                                                </td>

                                                <td class="py-1 text-right text-sm">
                                                    $ 21,000
                                                </td>
                                                <td class="py-1 text-right text-sm">Pagado
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="py-2 text-right font-bold" colspan="2">
                                                    Total Liquidación
                                                </td>
                                                <td class="py-2 text-right font-bold">
                                                    $ 91,036
                                                </td>
                                                <td class="text-right text-sm font-bold uppercase">
                                                    Pagado
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                <div class="cardBorde4 mx-xl-8 px-xl-8">
                    <a class="tipo-boton" href="#"
                        data-url="https://ejemplo.com/certificado.pdf">
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr class="py-2">
                                        <th class="text-left">
                                            Descargar Certificado
                                        </th>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    </div>
"""

HTML_SOLO_PRODESARROLLO = """<div class="container col-lg-10" id="liquidaciones-content">
    <div class="card">
        <div class="card-header">
            <h6>Certificación De Pago Recibo: 0012345678
                <span class="badge badge-success">Pagado</span>
            </h6>
        </div>
        <div class="card-body">
            <div>
                <label>Recibo Oficial:</label>
                <span>0012345678</span>
            </div>
            <div>
                <label>Contribuyente:</label>
                <span>100****** - ESTUDIANTE ANONIMO</span>
            </div>
            <div>
                <label>Fecha De Pago:</label>
                <span>2026-10-13</span>
            </div>
            <table class="table">
                <tbody>
                    <tr>
                        <td>165</td>
                        <td>Estampilla Prodesarrollo (Liquidacion Recibo)</td>
                        <td>$ 21,000</td>
                        <td>Pagado</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
"""

HTML_NO_PAGADO = """<div class="container col-lg-10" id="liquidaciones-content">
    <div class="card">
        <div class="card-header">
            <h6>Certificación De Pago Recibo: 0012345678
                <span class="badge badge-warning">Pendiente</span>
            </h6>
        </div>
        <div class="card-body">
            <div>
                <label>Recibo Oficial:</label>
                <span>0012345678</span>
            </div>
            <div>
                <label>Contribuyente:</label>
                <span>100****** - ESTUDIANTE ANONIMO</span>
            </div>
            <div>
                <label>Fecha De Pago:</label>
                <span>2026-10-13</span>
            </div>
            <table class="table">
                <tbody>
                    <tr>
                        <td>165</td>
                        <td>Estampilla Pro-Cultura</td>
                        <td>$ 70,036</td>
                        <td>Pendiente</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
"""

HTML_ESTRUCTURA_INCOMPLETA = """<div class="container">
    <div class="mensaje">
        <p>No se pudo cargar la vista de detalle del recibo</p>
    </div>
</div>
"""


@pytest.fixture
def html_pagado():
    return HTML_PAGADO_VALIDO


@pytest.fixture
def html_solo_prodesarrollo():
    return HTML_SOLO_PRODESARROLLO


@pytest.fixture
def html_no_pagado():
    return HTML_NO_PAGADO


@pytest.fixture
def html_incompleto():
    return HTML_ESTRUCTURA_INCOMPLETA
