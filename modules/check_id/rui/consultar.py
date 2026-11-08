import requests

url = "https://ventanillasocial.dnp.gov.co/Home/ObtenerDatosRUI"

# Identificador de ejemplo (ficticio). No versionar cédulas de personas reales.
ID_EJEMPLO = "1000000001"

pre_data = {
    "id": ID_EJEMPLO,
}


def consultar(pre_data):
    response = requests.post(
        url,
        data={
            "pNumDoc": pre_data["id"],
            "pTipDoc": "3",
        },
        timeout=10,
    )

    data = response.json()
    response_format = {
        "message": "",
        "success": "",
        "data": {
            "id": "",
            "nombre_completo": "",
        },
    }
    if data["ok"] is True:
        response_format["message"] = (
            "Se encontró información relacionada al documento suministrado"
        )
        response_format["success"] = True
        response_format["data"]["id"] = pre_data["id"]
        response_format["data"]["nombre_completo"] = data["nombre"]
    else:
        response_format["message"] = (
            "NO se encontró información relacionada al documento suministrado"
        )
        response_format["success"] = False
        response_format["data"]["id"] = pre_data["id"]
    return response_format


if __name__ == "__main__":
    # Prueba local manual; siempre con ID ficticio.
    print(consultar({"id": ID_EJEMPLO}))