import { test, expect } from '@playwright/test';
import {
    formatearPrograma,
    legibilizarCodigo,
    formatearEncabezadoProgramas,
} from '../app/lib/programas';
import { gruposPorNivel } from '../app/components/informacion_estudiante/campos';

test.describe('Nombres legibles de programas (Tarea 65)', () => {
    test('legibilizarCodigo convierte códigos a texto sin guiones bajos y con mayúsculas/minúsculas', () => {
        expect(legibilizarCodigo('PROGRAMA_DESCONOCIDO')).toBe('Programa Desconocido');
        expect(legibilizarCodigo('INGENIERIA_DE_SISTEMAS_Y_COMPUTACION')).toBe(
            'Ingenieria de Sistemas y Computacion',
        );
        expect(legibilizarCodigo('OTRO_PROGRAMA_DE_EJEMPLO')).toBe('Otro Programa de Ejemplo');
        expect(legibilizarCodigo('')).toBe('');
    });

    test('caso conocido: muestra el nombre legible exacto con tildes', () => {
        const resultado = formatearPrograma('INGENIERIA_DE_SISTEMAS_Y_COMPUTACION');
        expect(resultado).toBe('Ingeniería de Sistemas y Computación');
    });

    test('caso con catálogo personalizado: toma la etiqueta del catálogo', () => {
        const catalogo = [
            { valor: 'PROG_CUSTOM', etiqueta: 'Programa Personalizado de Prueba' },
        ];
        const resultado = formatearPrograma('PROG_CUSTOM', catalogo);
        expect(resultado).toBe('Programa Personalizado de Prueba');
    });

    test('caso desconocido: muestra versión legible sin guiones bajos y nunca el código crudo', () => {
        const codigoCrudo = 'PROGRAMA_TOTALMENTE_NUEVO';
        const resultado = formatearPrograma(codigoCrudo);
        expect(resultado).toBe('Programa Totalmente Nuevo');
        expect(resultado).not.toContain('_');
        expect(resultado).not.toBe(codigoCrudo);
    });

    test('caso con dos programas: el encabezado muestra los dos programas con sus nombres', () => {
        const encabezado = formatearEncabezadoProgramas(
            'INGENIERIA_DE_SISTEMAS_Y_COMPUTACION',
            'INGENIERIA_INDUSTRIAL',
        );
        expect(encabezado).toBe('Ingeniería de Sistemas y Computación · Ingeniería Industrial');
    });

    test('caso con dos programas donde uno es desconocido: muestra ambos legibles', () => {
        const encabezado = formatearEncabezadoProgramas(
            'INGENIERIA_DE_SISTEMAS_Y_COMPUTACION',
            'PROGRAMA_ESPECIAL_NO_CATALOGADO',
        );
        expect(encabezado).toBe(
            'Ingeniería de Sistemas y Computación · Programa Especial No Catalogado',
        );
        expect(encabezado).not.toContain('_');
    });

    test('encabezado con un solo programa muestra solo ese programa', () => {
        const encabezado = formatearEncabezadoProgramas('INGENIERIA_DE_SISTEMAS_Y_COMPUTACION');
        expect(encabezado).toBe('Ingeniería de Sistemas y Computación');
    });

    test('no duplica si el programa ya contiene al segundo programa', () => {
        const yaCombinado = 'Ingeniería de Sistemas y Computación · Ingeniería Industrial';
        const resultado = formatearEncabezadoProgramas(yaCombinado, 'Ingeniería Industrial');
        expect(resultado).toBe(yaCombinado);
    });

    test('campos de información del estudiante configuran formateo para programas', () => {
        const gruposPregrado = gruposPorNivel('PREGRADO');
        const campoPrograma = gruposPregrado
            .flatMap((g) => g.campos)
            .find((c) => c.clave === 'programa');
        const campoSegundoPrograma = gruposPregrado
            .flatMap((g) => g.campos)
            .find((c) => c.clave === 'segundoPrograma');

        expect(campoPrograma?.formatear).toBeDefined();
        expect(campoSegundoPrograma?.formatear).toBeDefined();

        expect(campoPrograma?.formatear?.('INGENIERIA_DE_SISTEMAS_Y_COMPUTACION')).toBe(
            'Ingeniería de Sistemas y Computación',
        );
        expect(campoPrograma?.formatear?.('CODIGO_DESCONOCIDO')).toBe('Codigo Desconocido');
        expect(campoSegundoPrograma?.formatear?.('INGENIERIA_INDUSTRIAL')).toBe('Ingeniería Industrial');

        const gruposPosgrado = gruposPorNivel('POSGRADO');
        const posPrograma = gruposPosgrado
            .flatMap((g) => g.campos)
            .find((c) => c.clave === 'programa');
        const posSegundo = gruposPosgrado
            .flatMap((g) => g.campos)
            .find((c) => c.clave === 'segundoPrograma');

        expect(posPrograma?.formatear).toBeDefined();
        expect(posSegundo?.formatear).toBeDefined();
        expect(posPrograma?.formatear?.('MAESTRIA_EN_INGENIERIA')).toBe('Maestría en Ingeniería');
    });
});
