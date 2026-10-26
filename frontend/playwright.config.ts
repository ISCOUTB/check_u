import { defineConfig, devices } from "@playwright/test";

// Pruebas de accesibilidad y responsive del frontend (issue #36). El backend no hace falta:
// cada prueba simula sus respuestas con page.route (ver e2e/soporte.ts).
export default defineConfig({
    testDir: "e2e",
    expect: { timeout: 10_000 },
    use: { baseURL: "http://localhost:3001" },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: "npm run dev",
        url: "http://localhost:3001",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
