"""python -m modules.validadores.estampilla: probar el validador con archivos propios."""

import json

from modules.validadores.estampilla import __main__ as comando


def test_sin_argumentos_muestra_el_uso(capsys):
    assert comando.main([]) == 1
    assert "Uso" in capsys.readouterr().out


def test_resumen_de_un_archivo(tmp_path, capsys, texto_certificado, crear_pdf):
    pdf = tmp_path / "certificado.pdf"
    pdf.write_bytes(crear_pdf(texto_certificado))
    assert comando.main([str(pdf)]) == 0
    salida = capsys.readouterr().out
    assert "certificado.pdf" in salida and "to_check" in salida and "official_record" in salida


def test_json(tmp_path, capsys):
    vacio = tmp_path / "vacio.pdf"
    vacio.write_bytes(b"")
    assert comando.main([str(vacio), "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["type_document"] == "estampilla_pro_cultura"


def test_sin_consultar_no_llama_a_la_gobernacion(tmp_path, capsys, monkeypatch, texto_certificado, crear_pdf):
    def no_debe_consultar(numero, version):
        raise AssertionError("sin --consultar no se envía el recibo a la Gobernación")

    monkeypatch.setattr(comando, "consultar_gobernacion", no_debe_consultar)
    pdf = tmp_path / "certificado.pdf"
    pdf.write_bytes(crear_pdf(texto_certificado))
    assert comando.main([str(pdf), "--json"]) == 0
    resultado = json.loads(capsys.readouterr().out)
    assert resultado["required_action"] == "wait_for_external_validation"


def test_con_consultar_llama_una_vez(tmp_path, capsys, monkeypatch, texto_certificado, crear_pdf, registro_oficial):
    llamadas = []

    def consultar(numero, version):
        llamadas.append(numero)
        return registro_oficial()

    monkeypatch.setattr(comando, "consultar_gobernacion", consultar)
    pdf = tmp_path / "certificado.pdf"
    pdf.write_bytes(crear_pdf(texto_certificado))
    assert comando.main([str(pdf), "--consultar", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["document_classification"] == "valid"
    assert llamadas == ["000000000001"]
