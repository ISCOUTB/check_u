"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import BotonTema from "@/app/components/ui/BotonTema";
import Button from "@/app/components/ui/Button";
import Field from "@/app/components/ui/Field";
import styles from "./FormularioLogin.module.css";

interface User {
    id: number;
    username: string;
    name: string;
    role: "estudiante" | "funcionario";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const ID_ERROR = "login-error";

export default function FormularioLogin() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [cargando, setCargando] = useState(false);

    async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setAviso("");
        setCargando(true);

        try {
            if (!API_URL) {
                throw new Error("No está configurada la URL del backend.");
            }

            let response: Response;
            try {
                response = await fetch(`${API_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ username: email.trim(), password }),
                });
            } catch {
                throw new Error("No fue posible conectar con el servidor.");
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    Array.isArray(data.message)
                        ? data.message.join(", ")
                        : data.message || "No se pudo iniciar sesión.",
                );
            }

            const user: User = data.user;
            setAviso(`Bienvenido, ${user.name}.`);
            router.push(user.role === "funcionario" ? "/funcionario/dashboard" : "/estudiante/home");
        } catch (causa) {
            setError(causa instanceof Error ? causa.message : "No fue posible conectar con el servidor.");
        } finally {
            setCargando(false);
        }
    }

    const camposConError = error ? { "aria-invalid": true, "aria-describedby": ID_ERROR } : {};

    return (
        <main id="contenido" tabIndex={-1} className={styles.login}>
            <section className={styles.columnaFormulario}>
                <div className={styles.contenido}>
                    <div className={styles.logos}>
                        <Image src="/icons/checku_logo.png" alt="CheckU" width={72} height={72} priority />
                        <div className={styles.logosDerecha}>
                            <Image
                                src="/icons/logo_utb1.png"
                                alt="Universidad Tecnológica de Bolívar"
                                width={95}
                                height={48}
                                priority
                            />
                            <BotonTema />
                        </div>
                    </div>

                    <h1 id="titulo-login" className={styles.titulo}>
                        Iniciar sesión
                    </h1>
                    <p className={styles.subtitulo}>Accede a CheckU para validar tus documentos de grado.</p>

                    <form aria-labelledby="titulo-login" className={styles.formulario} onSubmit={iniciarSesion} noValidate>
                        <Field
                            etiqueta="Correo institucional o usuario de prueba"
                            type="text"
                            name="email"
                            placeholder="correo@utb.edu.co"
                            autoComplete="username"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            {...camposConError}
                        />

                        <Field
                            etiqueta="Contraseña"
                            type="password"
                            name="password"
                            placeholder="Ingresa tu contraseña"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            {...camposConError}
                        />

                        <div className={styles.olvido}>
                            <Button
                                variante="sutil"
                                onClick={() =>
                                    setAviso("La recuperación de contraseña todavía no está disponible.")
                                }
                            >
                                ¿Olvidaste tu contraseña?
                            </Button>
                        </div>

                        {error && (
                            <p id={ID_ERROR} role="alert" className={styles.error}>
                                {error}
                            </p>
                        )}

                        <Button type="submit" cargando={cargando} textoCargando="Ingresando…" className={styles.enviar}>
                            Iniciar sesión
                        </Button>

                        <p role="status" className={styles.aviso}>
                            {aviso}
                        </p>
                    </form>

                    <p className={styles.descripcion}>
                        CheckU prevalidará tus documentos automáticamente y te indicará qué debes corregir antes de
                        enviar tu solicitud de grado.
                    </p>
                </div>
            </section>

            <section className={styles.columnaFoto} aria-labelledby="titulo-foto">
                <div className={styles.foto} data-testid="login-foto">
                    <Image
                        src="/images/gradosutb.png"
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className={styles.imagen}
                        priority
                    />
                    <div className={styles.textoFoto}>
                        <span className={styles.marca}>CHECKU</span>
                        <h2 id="titulo-foto" className={styles.lema}>
                            Tu solicitud de grado, más sencilla.
                        </h2>
                        <p className={styles.bajada}>
                            Verifica tus documentos antes de iniciar formalmente tu proceso de grado.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}
