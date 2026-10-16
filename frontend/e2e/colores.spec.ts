import { expect, test } from "@playwright/test";
import { globSync, readFileSync } from "node:fs";

// Ningún color fijo en el alcance de la issue #36: todos salen de los tokens de globals.css.
// estudiante/preinscripcion queda fuera (Tarea 16, en curso).
const ALCANCE = globSync("app/**/*.css", { cwd: process.cwd() }).filter(
    (archivo) =>
        !archivo.replaceAll("\\", "/").startsWith("app/estudiante/preinscripcion/") && !archivo.endsWith("globals.css"),
);

test("hay hojas de estilo en el alcance", () => expect(ALCANCE.length).toBeGreaterThan(5));

for (const archivo of ALCANCE)
    test(`${archivo} no tiene colores fijos`, () => {
        const css = readFileSync(archivo, "utf8");
        expect(css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).toEqual([]);
    });
