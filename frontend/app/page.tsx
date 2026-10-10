
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface User {
    id: number;
    username: string;
    name: string;
    role: 'estudiante' | 'funcionario';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Login() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setMessage('');
        setLoading(true);

        try {
            if (!API_URL) {
                throw new Error(
                    'No está configurada la URL del backend.'
                );
            }

            const response = await fetch(
                `${API_URL}/auth/login`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        username: email.trim(),
                        password,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    Array.isArray(data.message)
                        ? data.message.join(', ')
                        : data.message ||
                          'No se pudo iniciar sesión.'
                );
            }

            const user: User = data.user;

            setMessage(`Bienvenido, ${user.name}.`);

            if (user.role === 'funcionario') {
                router.push('/funcionario/dashboard');
            } else {
                router.push('/estudiante/home');
            }
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'No fue posible conectar con el servidor.'
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className={styles.login}>
            <section className={styles.loginForm}>
                <div className={styles.formContent}>
                    <div
                        className={`${styles.flex} ${styles.spaceBetween}`}
                    >
                        <img
                            className={styles.logo}
                            src="/icons/checku_logo.png"
                            alt="Logo de CheckU"
                        />

                        <img
                            className={styles.logo}
                            src="/icons/logo_utb1.png"
                            alt="Logo de la UTB"
                        />
                    </div>

                    <h1>Iniciar sesión</h1>

                    <p className={styles.subtitle}>
                        Accede a CheckU para validar tus documentos de grado.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email">
                                Correo institucional o usuario de prueba
                            </label>

                            <input
                                type="text"
                                id="email"
                                name="email"
                                placeholder="correo@utb.edu.co"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                autoComplete="username"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password">
                                Contraseña
                            </label>

                            <input
                                type="password"
                                id="password"
                                name="password"
                                placeholder="Ingresa tu contraseña"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        <div className={styles.forgot}>
                            <a
                                href="#"
                                onClick={(event) => event.preventDefault()}
                            >
                                ¿Olvidaste tu contraseña?
                            </a>
                        </div>

                        <button type="submit" disabled={loading}>
                            {loading
                                ? 'Validando credenciales...'
                                : 'Iniciar sesión'}
                        </button>

                        {message && (
                            <p role="status" aria-live="polite">
                                {message}
                            </p>
                        )}
                    </form>

                    <p className={styles.description}>
                        CheckU prevalidará tus documentos automáticamente
                        y te indicará qué debes corregir antes de enviar
                        tu solicitud de grado.
                    </p>
                </div>
            </section>

            <section className={styles.loginImage}>
                <div className={styles.imageContent}>
                    <div className={styles.imageOverlay}>
                        <span>CHECKU</span>

                        <h2>
                            Tu solicitud de grado,
                            más sencilla.
                        </h2>

                        <p>
                            Verifica tus documentos antes de iniciar
                            formalmente tu proceso de grado.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}