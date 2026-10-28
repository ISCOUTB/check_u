import { test, expect } from '@playwright/test';
import { sesionComo, API, revisarAxe } from './soporte';
import { etiquetaPropiedad, valorVisible } from '@/app/estudiante/preinscripcion/etiquetas';
const PDF = '%PDF-1.4\nPrueba sintética\n%%EOF';
const detalle = {
  id:'1',estadoSolicitud:'EN_PROCESO',estadoAnalisis:'registrado',
  estudiante:{codigo:'T00000001',nombre:'Estudiante Prueba',nivel:'PREGRADO',correo:'prueba@example.org',tipoDocumento:'CC',numeroDocumento:'1000000001',fechaNacimiento:'',programa:'Ingeniería',facultad:'',telefono:'',ciudad:'',fechaSolicitud:''},
  informacion:{nombres:'Estudiante',apellidos:'Prueba',codigoEstudiantil:'T00000001',correo:'prueba@example.org',tipoDocumento:'CC',numeroDocumento:'1000000001',fechaNacimiento:'',genero:'',telefonoFijo:'',telefonoCelular:'',departamento:'',ciudad:'',direccion:'',modalidad:'PRESENCIAL',programa:'Ingeniería'},
  documentos:[1,2].map(orden=>({id:String(orden),tipo:'estampilla_pro_cultura',orden,version:1,archivoDisponible:true,nombre:`Estampilla ${orden}`,descripcion:`estampilla${orden}.pdf`,fileName:`estampilla${orden}.pdf`,
    resultados:[{estado:'no_valido',mensaje:'El número del comprobante no corresponde al registro oficial.'}],resubmission_allowed:true,
    analisis:{extracted_data:{code_student:{value:'T00000001',confidence:1},full_name_student:{value:'Estudiante Prueba',confidence:1},propiedad_no_conocida:{value:'Dato leído',confidence:null}},
      rules:[{rule:'internal_rule_name',result:'no_cumple',message:'El número del comprobante no corresponde al registro oficial.'}],errors:[]}})),
  politicaReenvios:{usados:0,limite:3,zona:'America/Bogota'},
};
test('etiquetas en español sin nombres técnicos, booleanos y campos desconocidos',()=>{
  expect(etiquetaPropiedad('code_student',0)).toBe('Código estudiantil');
  expect(etiquetaPropiedad('full_name_student',1)).toBe('Nombre completo del estudiante');
  expect(etiquetaPropiedad('clave_desconocida',2)).toBe('Dato adicional 3');expect(valorVisible(false)).toBe('No');
});
for(const tema of ['light','dark'] as const){
  test(`PDF original privado, etiquetas y observaciones legibles en ${tema}`,async({page})=>{
    await sesionComo(page,'estudiante');await page.emulateMedia({colorScheme:tema});await page.setViewportSize({width:360,height:900});
    await page.route(`${API}/estudiante/solicitud/analisis`,r=>r.fulfill({json:detalle}));
    let pdfSolicitados=0;await page.route(`${API}/estudiante/documentos/*/original`,r=>{pdfSolicitados++;return r.fulfill({contentType:'application/pdf',body:PDF});});
    await page.goto('/estudiante/preinscripcion');await page.getByRole('button',{name:'Ver análisis automático'}).first().click();
    const dialogo=page.getByRole('dialog');await expect(dialogo.getByTitle('Vista previa del documento original')).toHaveAttribute('src',/^blob:/);
    await expect(dialogo).toContainText('Código estudiantil');await expect(dialogo).toContainText('Nombre completo del estudiante');
    await expect(dialogo).not.toContainText('code_student');await expect(dialogo).not.toContainText('internal_rule_name');await expect(dialogo).not.toContainText('propiedad_no_conocida');
    await expect(dialogo).toContainText('El número del comprobante no corresponde al registro oficial.');expect(pdfSolicitados).toBeGreaterThanOrEqual(1);
    await revisarAxe(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
  });
}
test('archivo vencido muestra motivo específico y conserva el análisis',async({page})=>{
  await sesionComo(page,'estudiante');await page.route(`${API}/estudiante/solicitud/analisis`,r=>r.fulfill({json:detalle}));
  await page.route(`${API}/estudiante/documentos/*/original`,r=>r.fulfill({status:410,json:{message:'Caducado'}}));
  await page.goto('/estudiante/preinscripcion');await page.getByRole('button',{name:'Ver análisis automático'}).first().click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('terminó su plazo');
  await expect(page.getByRole('dialog')).toContainText('Código estudiantil');
});
test('reenvía cada estampilla por su identificador, muestra progreso y consulta las versiones actualizadas',async({page})=>{
  await sesionComo(page,'estudiante');let consultas=0;
  await page.route(`${API}/estudiante/solicitud/analisis`,r=>{consultas++;return r.fulfill({json:consultas===1?detalle:{...detalle,documentos:detalle.documentos.map(d=>({...d,version:2})),politicaReenvios:{usados:1,limite:3,zona:'America/Bogota'}}});});
  let enviados=0;await page.route(`${API}/solicitudes/1/correcciones`,async r=>{
    enviados++;const contenido=r.request().postDataBuffer()!.toString();expect(contenido).toContain('[1,2]');expect(contenido).toContain('estampilla1.pdf');expect(contenido).toContain('estampilla2.pdf');
    await r.fulfill({contentType:'application/x-ndjson',body:[
      {tipo:'progreso',etapa:'Verificando comprobante de pago de estampilla 1.',porcentaje:60,estado:'procesando'},
      {tipo:'progreso',etapa:'Generando análisis documental.',porcentaje:80,estado:'procesando'},
      {tipo:'progreso',etapa:'Resultados listos. Redirigiendo…',porcentaje:100,estado:'completado'},
      {tipo:'resultado',resultado:{ok:true,mensaje:'Corrección registrada.'}},
    ].map(e=>JSON.stringify(e)).join('\n')+'\n'});
  });
  await page.goto('/estudiante/preinscripcion');
  for(let i=0;i<2;i++){const elegir=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Volver a cargar'}).first().click();await(await elegir).setFiles({name:`estampilla${i+1}.pdf`,mimeType:'application/pdf',buffer:Buffer.from(PDF)});await expect(page.getByText(`estampilla${i+1}.pdf · listo para enviar`)).toBeVisible();}
  await page.getByRole('button',{name:'Enviar documentos',exact:true}).click();
  await expect(page.getByText('Corrección registrada.',{exact:true})).toBeVisible();expect(enviados).toBe(1);
  await expect(page.getByText('Versión 2')).toHaveCount(2);await expect(page.getByRole('progressbar')).toHaveAttribute('value','100');expect(consultas).toBe(2);
});
test('un error del servidor conserva los archivos y no anuncia 100 % ni éxito',async({page})=>{
  await sesionComo(page,'estudiante');await page.route(`${API}/estudiante/solicitud/analisis`,r=>r.fulfill({json:detalle}));
  await page.route(`${API}/solicitudes/1/correcciones`,r=>r.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({tipo:'error',etapa:'Verificando documento.',porcentaje:40,estado:'error',mensaje:'Alcanzaste el límite de reenvíos.',codigo:409})+'\n'}));
  await page.goto('/estudiante/preinscripcion');const elegir=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Volver a cargar'}).first().click();await(await elegir).setFiles({name:'corregido.pdf',mimeType:'application/pdf',buffer:Buffer.from(PDF)});
  await page.getByRole('button',{name:'Enviar documentos',exact:true}).click();await expect(page.getByText('Alcanzaste el límite de reenvíos.',{exact:true})).toBeVisible();
  await expect(page.getByRole('progressbar')).not.toHaveAttribute('value','100');await expect(page.getByText('corregido.pdf · listo para enviar')).toBeVisible();
});

test('el primer envío confirma el resultado antes de redirigir', async ({ page }) => {
  await sesionComo(page, 'estudiante');
  await page.route(`${API}/estudiante/solicitud/analisis`, r => r.fulfill({json: detalle}));
  let confirmar!: () => void;
  const espera = new Promise<void>(r => { confirmar = r; });
  await page.route(`${API}/solicitudes/enviar`, async r => { await espera; return r.fulfill({contentType: 'application/x-ndjson', body: [
    {tipo:'progreso', etapa:'Verificando documento de identidad.', porcentaje:50, estado:'procesando'},
    {tipo:'resultado', resultado:{ok:true, mensaje:'Preinscripción registrada correctamente.'}},
  ].map(e => JSON.stringify(e)).join('\n')+'\n'}); });
  await page.goto('/estudiante/iniciar_preinscripcion?nivel=POSGRADO');
  await page.getByLabel('Nombres (obligatorio)').fill('Ana');
  await page.getByLabel('Apellidos (obligatorio)').fill('Prueba');
  await page.getByLabel('Tipo de documento (obligatorio)').selectOption({label:'Cédula de ciudadanía'});
  await page.getByLabel('Número de documento (obligatorio)').fill('1234567890');
  await page.getByLabel('Código estudiantil (obligatorio)').fill('T00012345');
  await page.getByRole('radiogroup', {name:'Modalidad (obligatorio)'}).getByRole('radio',{name:'Presencial'}).check();
  await page.getByLabel('Programa (obligatorio)').fill('Programa de ejemplo');
  for (const id of ['identification','paz_y_salvo_bib','estampilla_pro_cultura']) {
    await page.locator(`#documento-${id}`).setInputFiles({name:`${id}.pdf`,mimeType:'application/pdf',buffer:Buffer.from(PDF)});
  }
  await page.getByRole('button',{name:'Enviar preinscripción',exact:true}).click();
  const dialogo = page.getByRole('dialog',{name:'Revisa tu información antes de enviar'});
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button',{name:'Enviar',exact:true}).click();
  await expect(dialogo.getByRole('progressbar')).toBeVisible();
  await expect(dialogo.getByRole('progressbar')).not.toHaveAttribute('value','100');
  confirmar();
  await expect(page).toHaveURL(/\/estudiante\/preinscripcion$/);
  await expect(page.getByRole('heading',{name:'Detalle de mi preinscripción'})).toBeVisible();
});
