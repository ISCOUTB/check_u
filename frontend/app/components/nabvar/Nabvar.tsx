import styles from "./Navbar.module.css";

interface NavbarProps {
    tipoUsuario: "estudiante" | "funcionario";
    nombreUsuario: string;
    nivel?: "PREGRADO" | "POSGRADO";
}

export default function Navbar({
    tipoUsuario,
    nombreUsuario,
    nivel
}: NavbarProps) {

    const esEstudiante = tipoUsuario === "estudiante";

    return (
        <nav className={styles.navbar}>

            <div className={styles.navbarBrand}>

                <img
                    src="/icons/checku_logo.png"
                    alt="CheckU"
                    className={styles.navbarLogo}
                />

                <div className={styles.navbarTitle}>

                    <span className={styles.navbarName}>
                        CheckU
                    </span>

                    <span className={styles.navbarSubtitle}>
                        {esEstudiante
                            ? "Seguimiento de preinscripción"
                            : "Preinscripciones"
                        }
                    </span>

                </div>

            </div>

            <div className={styles.navbarUser}>

                <div className={styles.navbarUserInfo}>

                    <span className={styles.navbarUserName}>
                        {nombreUsuario}
                    </span>

                    <span className={styles.navbarUserRole}>
                        {esEstudiante
                            ? "Candidato a grado"
                            : "Funcionaria de grados"
                        }
                    </span>

                </div>

                {esEstudiante && nivel && (
                    <span className={styles.navbarLevel}>
                        {nivel}
                    </span>
                )}

            </div>

        </nav>
    );
}