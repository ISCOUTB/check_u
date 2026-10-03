<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="style/style.css">
    <title>Iniciar sesión - CheckU Grados</title>
</head>

<body>

    <main class="login">

        <section class="login_form">

            <div class="form_content">
                <div class="flex space-between">
                    <img class="logo" src="icons/checku_logo.png" alt="Logo de CheckU">
                    <img class="logo" src="icons/logo_utb1.png" alt="Logo de la UTB">
                </div>

                <h1>Iniciar sesión</h1>

                <p class="subtitle">
                    Accede a CheckU para validar tus documentos de grado.
                </p>

                <form>

                    <div class="input_group">
                        <label for="email">Correo institucional</label>
                        <input type="email" id="email" name="email" placeholder="tucorreo@utb.edu.co" required>
                    </div>

                    <div class="input_group">
                        <label for="password">Contraseña</label>
                        <input type="password" id="password" name="password" placeholder="Ingresa tu contraseña"
                            required>
                    </div>

                    <div class="forgot">
                        <a href="#">¿Olvidaste tu contraseña?</a>
                    </div>

                    <button type="submit">
                        Iniciar sesión
                    </button>

                </form>

                <p class="description">
                    CheckU prevalidará tus documentos automáticamente
                    y te indicará qué debes corregir antes de enviar
                    tu solicitud de grado.
                </p>

            </div>

        </section>

        <section class="login_image">

            <div class="image_content">

                <div class="image_overlay">
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

</body>

</html>