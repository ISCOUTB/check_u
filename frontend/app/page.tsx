import styles from "./page.module.css";

export default function Login() {
    return (
        <main className={styles.login}>

            <section className={styles.loginForm}>

                <div className={styles.formContent}>

                    <div className={`${styles.flex} ${styles.spaceBetween}`}>
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

                    <form>

                        <div className={styles.inputGroup}>
                            <label htmlFor="email">
                                Correo institucional
                            </label>

                            <input
                                type="email"
                                id="email"
                                name="email"
                                placeholder="tucorreo@utb.edu.co"
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
                                required
                            />
                        </div>

                        <div className={styles.forgot}>
                            <a href="#">
                                ¿Olvidaste tu contraseña?
                            </a>
                        </div>

                        <button type="submit">
                            Iniciar sesión
                        </button>

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