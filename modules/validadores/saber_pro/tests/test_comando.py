"""python -m modules.validadores.saber_pro: el comando para probar el validador con PDF propios."""

import json

from modules.validadores.saber_pro.__main__ import main


def test_sin_argumentos_muestra_el_uso(capsys):
    assert main([]) == 1
    assert "Uso" in capsys.readouterr().out


def test_resumen_de_un_archivo(tmp_path, capsys):
    vacio = tmp_path / "vacio.pdf"
    vacio.write_bytes(b"")
    assert main([str(vacio)]) == 0
    salida = capsys.readouterr().out
    assert "vacio.pdf" in salida
    assert "to_check" in salida
    assert "saber_pro_report" in salida
    assert "\033[" not in salida  # sin colores cuando la salida no es una terminal


def test_json(tmp_path, capsys):
    vacio = tmp_path / "vacio.pdf"
    vacio.write_bytes(b"")
    assert main([str(vacio), "--json"]) == 0
    resultado = json.loads(capsys.readouterr().out)
    assert resultado["document_classification"] == "to_check"
    assert resultado["type_document"] == "saber_pro"


def test_carpeta_valida_todos_sus_pdf(tmp_path, capsys):
    for nombre in ("a.pdf", "b.pdf"):
        (tmp_path / nombre).write_bytes(b"")
    (tmp_path / "notas.txt").write_text("no es un pdf")
    assert main([str(tmp_path)]) == 0
    salida = capsys.readouterr().out
    assert "a.pdf" in salida and "b.pdf" in salida
    assert "notas.txt" not in salida


def test_archivo_inexistente(tmp_path, capsys):
    assert main([str(tmp_path / "no-existe.pdf")]) == 1
    assert "No existe" in capsys.readouterr().out
