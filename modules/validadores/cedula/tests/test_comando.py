"""python -m modules.validadores.cedula: probar el validador con archivos propios."""

import json

from modules.validadores.cedula.__main__ import main


def test_sin_argumentos_muestra_el_uso(capsys):
    assert main([]) == 1
    assert "Uso" in capsys.readouterr().out


def test_resumen_de_un_archivo(tmp_path, capsys):
    vacio = tmp_path / "vacia.png"
    vacio.write_bytes(b"")
    assert main([str(vacio)]) == 0
    salida = capsys.readouterr().out
    assert "vacia.png" in salida and "to_check" in salida and "identification_document" in salida
    assert "\033[" not in salida


def test_json(tmp_path, capsys):
    vacio = tmp_path / "vacia.pdf"
    vacio.write_bytes(b"")
    assert main([str(vacio), "--json"]) == 0
    resultado = json.loads(capsys.readouterr().out)
    assert resultado["type_document"] == "identification"


def test_carpeta_acepta_pdf_e_imagenes(tmp_path, capsys):
    for nombre in ("a.pdf", "b.png", "c.jpg", "d.jpeg"):
        (tmp_path / nombre).write_bytes(b"")
    (tmp_path / "notas.txt").write_text("no es una cédula")
    assert main([str(tmp_path)]) == 0
    salida = capsys.readouterr().out
    assert all(nombre in salida for nombre in ("a.pdf", "b.png", "c.jpg", "d.jpeg"))
    assert "notas.txt" not in salida


def test_archivo_inexistente(tmp_path, capsys):
    assert main([str(tmp_path / "no-existe.png")]) == 1
    assert "No existe" in capsys.readouterr().out


def test_sin_rui_no_consulta(tmp_path, capsys, monkeypatch):
    import modules.validadores.fuentes.rui as rui

    monkeypatch.setattr(rui, "consultar_rui", lambda *a, **k: (_ for _ in ()).throw(AssertionError("consultó el RUI")))
    vacio = tmp_path / "vacia.png"
    vacio.write_bytes(b"")
    assert main([str(vacio)]) == 0
