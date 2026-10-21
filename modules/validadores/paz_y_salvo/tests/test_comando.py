"""python -m modules.validadores.paz_y_salvo: probar el validador con archivos propios."""

import json

from modules.validadores.paz_y_salvo.__main__ import main


def test_sin_argumentos_muestra_el_uso(capsys):
    assert main([]) == 1
    assert "Uso" in capsys.readouterr().out


def test_resumen_de_un_archivo(tmp_path, capsys):
    vacio = tmp_path / "vacio.pdf"
    vacio.write_bytes(b"")
    assert main([str(vacio)]) == 0
    salida = capsys.readouterr().out
    assert "vacio.pdf" in salida and "to_check" in salida and "paz_y_salvo_document" in salida
    assert "\033[" not in salida


def test_json(tmp_path, capsys):
    vacio = tmp_path / "vacio.pdf"
    vacio.write_bytes(b"")
    assert main([str(vacio), "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["type_document"] == "paz_y_salvo_bib"


def test_carpeta_valida_sus_pdf(tmp_path, capsys):
    for nombre in ("a.pdf", "b.pdf"):
        (tmp_path / nombre).write_bytes(b"")
    (tmp_path / "notas.txt").write_text("no es un pdf")
    assert main([str(tmp_path)]) == 0
    salida = capsys.readouterr().out
    assert "a.pdf" in salida and "b.pdf" in salida and "notas.txt" not in salida


def test_archivo_inexistente(tmp_path, capsys):
    assert main([str(tmp_path / "no-existe.pdf")]) == 1
    assert "No existe" in capsys.readouterr().out
