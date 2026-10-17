# Certificados de Camerfirma Colombia

Son los certificados **públicos** de la autoridad certificadora que emitió el certificado con el que el ICFES firma los reportes Saber Pro. `firma.py` los usa como raíces de confianza para validar la cadena de esa firma (regla informativa `icfes_certificate_valid`). No son llaves ni certificados propios: `.gitignore` tiene una excepción solo para esta carpeta.

| Archivo | Sujeto | Emisor | Vigencia | SHA-256 |
|---|---|---|---|---|
| `root-camerfirma-colombia-v2.crt` | ROOT CAMERFIRMA COLOMBIA v2 (AC CAMERFIRMA COLOMBIA S.A.S) | él mismo (raíz) | 26/01/2022 – 19/01/2052 | `AF:4A:E0:07:EE:C3:14:51:7A:88:B6:AC:78:AA:16:69:BB:0F:40:36:F5:A3:17:E5:66:57:D9:9B:40:2F:D6:F1` |
| `subca-camerfirma-colombia-sas-v2.crt` | SUBCA CAMERFIRMA COLOMBIA SAS v2 | ROOT CAMERFIRMA COLOMBIA v2 | 26/01/2022 – 27/01/2047 | `81:BE:4E:D2:4B:ED:E1:5B:4A:97:A3:1D:37:5A:B2:7A:AC:27:18:2F:41:8D:B8:A6:E5:3E:C7:A8:ED:F8:8A:89` |

## Origen

Se descargaron el 17/10/2026 del repositorio de certificados de Camerfirma Colombia, el mismo servidor que el certificado del ICFES indica para su CRL y su OCSP:

- raíz: `http://pkicol.camerfirmacolombia.co/ejbca/publicweb/webdist/certdist?cmd=cacert&issuer=<DN de la SUBCA>&level=1`
- SUBCA: lo mismo con `level=0`

`<DN de la SUBCA>` es `CN=SUBCA CAMERFIRMA COLOMBIA SAS v2,SN=901312112-4,OU=Certificados Para Firma Electronica Camerfirma Colombia,O=CAMERFIRMA COLOMBIA SAS,L=BOGOTA D.C.,C=CO`, codificado para URL.

El servidor solo responde por `http`. Por eso se comprobó la cadena con `openssl verify`:
- la raíz firmó la SUBCA;
- la SUBCA firmó el certificado del ICFES (NIT 860024301-6) que viene en los reportes.

## Para renovarlos

Si Camerfirma cambia de raíz o de SUBCA:
1. descargar los nuevos certificados;
2. comprobar la cadena con `openssl verify`;
3. actualizar esta tabla y subir la versión de las reglas (`VERSION` en `reglas.py`).
