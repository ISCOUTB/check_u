import { defineConfig, devices } from "@playwright/test";

// Tarea 53: pruebas de flujo de extremo a extremo contra la aplicación real (ver e2e-flujo/README.md).
// Es una suite aparte de `e2e/`: necesita el entorno de e2e-flujo/levantar-entorno.ps1, comparte una sola
// base de datos y por eso corre en serie.
export default defineConfig({
    testDir: "e2e-flujo",
    workers: 1,
    fullyParallel: false,
    retries: 0,
    timeout: 240_000,
    expect: { timeout: 20_000 },
    outputDir: "test-results-flujo",
    reporter: [["list"], ["json", { outputFile: "test-results-flujo/resultados.json" }]],
    use: { baseURL: "http://localhost:3001", locale: "es-CO", timezoneId: "America/Bogota", viewport: { width: 1280, height: 900 } },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
});
