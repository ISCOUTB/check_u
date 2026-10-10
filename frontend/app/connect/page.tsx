
'use client';

import { useEffect, useState } from 'react';

interface HealthResponse {
    status: string;
    service: string;
    message: string;
}

export default function ConexionPage() {
    const [data, setData] = useState<HealthResponse | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        async function comprobarConexion() {
            try {
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/health`,
                );

                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }

                const result: HealthResponse = await response.json();
                setData(result);
            } catch (error) {
                console.error('Error al conectar con CheckU API:', error);

                setError(
                    error instanceof Error
                        ? error.message
                        : 'No fue posible conectar con el backend de CheckU.',
                );
            }
        }

        comprobarConexion();
    }, []);

    return (
        <main
            style={{
                maxWidth: '600px',
                margin: '80px auto',
                padding: '24px',
                fontFamily: 'Arial, sans-serif',
            }}
        >
            <h1>CheckU - Prueba de conexión</h1>

            {!data && !error && <p>Conectando con el backend...</p>}

            {data && (
                <section>
                    <h2>Conexión exitosa</h2>
                    <p>Estado: {data.status}</p>
                    <p>Servicio: {data.service}</p>
                    <p>{data.message}</p>
                </section>
            )}

            {error && (
                <p style={{ color: 'crimson' }}>{error}</p>
            )}
        </main>
    );
}