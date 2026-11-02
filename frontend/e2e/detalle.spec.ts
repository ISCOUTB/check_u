import { expect, test } from '@playwright/test';
import { ANCHOS, API, DETALLE_FUNCIONARIA, revisarAxe, sesionComo, TEMAS } from './soporte';
const DETALLE = '/funcionario/detalle_preinscripcion/1';
test.beforeEach(async ({page}) => { await page.emulateMedia({reducedMotion:'reduce'}); });

for (const tema of TEMAS) for (const ancho of ANCHOS) {
    test(`revisión real accesible y sin desborde (${tema}, ${ancho}px)`, async ({page}) => {
        await sesionComo(page, 'funcionario');
        await page.setViewportSize({width:ancho,height:1000});
        await page.emulateMedia({colorScheme:tema,reducedMotion:'reduce'});
        await page.goto(DETALLE);
        await expect(page.getByRole('heading',{name:'Acciones de revisión',exact:true})).toBeVisible();
        await revisarAxe(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(0);
    });
}
test('sin sesión redirige al login',async ({page}) => {
    await sesionComo(page,null); await page.goto(DETALLE); await expect(page).toHaveURL('/');
});
test('consulta información y análisis persistidos, conserva foco al cerrar',async ({page}) => {
    await sesionComo(page,'funcionario'); await page.goto(DETALLE);
    await expect(page.getByLabel('Tipo de discapacidad')).toHaveValue('Física');
    const abrir=page.getByRole('button',{name:'Ver análisis automático: Documento de identidad'});
    await abrir.click();
    const dialogo=page.getByRole('dialog');
    await expect(dialogo).toContainText('Nombre completo del estudiante');
    await revisarAxe(page);
    for(let i=0;i<6;i++) { await page.keyboard.press('Tab'); expect(await dialogo.evaluate(d=>d.contains(document.activeElement))).toBe(true); }
    await page.keyboard.press('Escape'); await expect(dialogo).toBeHidden(); await expect(abrir).toBeFocused();
});
for(const [accion,boton,estado] of [
    ['comentario','Enviar comentario','EN_PROCESO'],['recarga','Solicitar corrección','POR_REVISAR'],
    ['aceptada','Aceptar solicitud','ACEPTADA'],['anulada','Anular solicitud','CERRADA'],
] as const) {
    test(`confirma y persiste ${accion} mediante API y muestra historial`, async ({page}) => {
        await sesionComo(page,'funcionario');
        // Tarea 42a: solo se acepta una solicitud válida.
        let detalle={...structuredClone(DETALLE_FUNCIONARIA),...(accion==='aceptada'?{estadoSolicitud:'VALIDA'}:{})};
        await page.route(`${API}/funcionario/solicitudes/1`,r=>r.fulfill({json:detalle}));
        let envios=0;
        await page.route(`${API}/funcionario/solicitudes/1/revisiones`,async r=> {
            envios++;
            expect(r.request().method()).toBe('POST');
            expect(r.request().postDataJSON()).toEqual({accion,comentario:'Revisa el documento completo.',...(accion==='recarga'?{documentos:[11]}:{})});
            detalle={...detalle,estadoSolicitud:estado};
            await r.fulfill({status:201,json:{ok:true,idRevision:1}});
        });
        await page.goto(DETALLE);
        await page.getByRole('combobox',{name:'Acción',exact:true}).selectOption(accion);
        if(accion==='recarga') {
            await expect(page.getByRole('checkbox')).toHaveCount(1);
            await page.getByRole('checkbox',{name:'Estampilla Pro-Cultura'}).check();
        }
        await page.getByLabel(/Comentario \(/).fill('Revisa el documento completo.');
        await page.getByRole('button',{name:boton,exact:true}).click();
        expect(envios).toBe(0);
        const dialogo=page.getByRole('dialog'); await expect(dialogo).toBeVisible();
        await revisarAxe(page);
        await dialogo.getByRole('button',{name:'Confirmar acción'}).click();
        await expect(page.getByRole('status')).toContainText('Acción registrada');
        expect(envios).toBe(1);
        await expect(dialogo).toBeHidden();
        if(estado==='ACEPTADA'||estado==='CERRADA') await expect(page.getByRole('button',{name:boton,exact:true})).toBeDisabled();
        await page.reload();
        await expect(page.getByRole('heading',{name:'Acciones de revisión',exact:true})).toBeVisible();
        expect(envios).toBe(1);
    });
}
test('cancelar confirmación no envía y corrección exige selección',async ({page})=>{
    await sesionComo(page,'funcionario'); let envios=0;
    await page.route(`${API}/funcionario/solicitudes/1/revisiones`,r=>{envios++;return r.fulfill({status:201,json:{ok:true}});});
    await page.goto(DETALLE);
    await page.getByRole('combobox',{name:'Acción',exact:true}).selectOption('recarga');
    await page.getByRole('button',{name:'Solicitar corrección',exact:true}).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('Selecciona al menos');
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Solicitar corrección',exact:true}).click();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    expect(envios).toBe(0);
});
test('fallo al guardar conserva comentario y obliga a consultar antes de repetir',async ({page})=>{
    await sesionComo(page,'funcionario');
    await page.route(`${API}/funcionario/solicitudes/1/revisiones`,r=>r.fulfill({status:503,json:{message:'Base no disponible'}}));
    await page.goto(DETALLE);
    await page.getByLabel('Comentario (obligatorio)').fill('Conservar este comentario');
    await page.getByRole('button',{name:'Enviar comentario',exact:true}).click();
    await page.getByRole('button',{name:'Confirmar acción',exact:true}).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('Base no disponible');
    await expect(page.getByLabel('Comentario (obligatorio)')).toHaveValue('Conservar este comentario');
    await expect(page.getByRole('button',{name:'Enviar comentario',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Actualizar solicitud'}).click();
    await expect(page.getByRole('button',{name:'Enviar comentario',exact:true})).toBeEnabled();
});
test('solicitud inexistente no presenta datos de ejemplo ni acciones',async ({page})=>{
    await sesionComo(page,'funcionario');
    await page.route(`${API}/funcionario/solicitudes/1`,r=>r.fulfill({status:404,json:{message:'Solicitud no disponible.'}}));
    await page.goto(DETALLE);
    await expect(page.locator('main').getByRole('alert')).toContainText('Solicitud no disponible.');
    await expect(page.getByRole('button',{name:'Enviar comentario',exact:true})).toHaveCount(0);
    await expect(page.getByText('Ana Prueba',{exact:true})).toHaveCount(0);
});

test('solo se acepta una solicitud válida', async ({page}) => {
    await sesionComo(page,'funcionario');
    await page.route(`${API}/funcionario/solicitudes/1`,r=>r.fulfill({json:{...DETALLE_FUNCIONARIA,estadoSolicitud:'NO_VALIDA'}}));
    await page.goto(DETALLE);
    await expect(page.getByText('Estado:')).toContainText('No válida');
    await expect(page.getByRole('option',{name:'Aceptar solicitud'})).toHaveAttribute('disabled','');
    await expect(page.getByText('Solo se puede aceptar una solicitud válida.',{exact:true})).toBeVisible();
    await expect(page.getByRole('option',{name:'Anular solicitud'})).not.toHaveAttribute('disabled');
});

/** El detalle de prueba con un Paz y Salvo por revisar (Biblioteca no respondió). */
function conPorRevisar() {
    const detalle = structuredClone(DETALLE_FUNCIONARIA);
    detalle.documentos.push({id:'12',nombre:'Paz y Salvo de Biblioteca',tipo:'paz_y_salvo_bib',orden:1,version:1,fileName:'paz.pdf',descripcion:'paz.pdf',archivoDisponible:false,resubmission_allowed:true,
        estado:'POR_REVISAR',resultados:[{estado:'por_revisar',mensaje:'No fue posible consultar a Biblioteca. Una funcionaria lo revisará.'}],analisis:null} as typeof detalle.documentos[number]);
    return detalle;
}

test('marcar válido un documento por revisar lo confirma y envía la resolución', async ({page}) => {
    await sesionComo(page,'funcionario');
    let detalle = conPorRevisar();
    await page.route(`${API}/funcionario/solicitudes/1`,r=>r.fulfill({json:detalle}));
    const cuerpos: unknown[] = [];
    await page.route(`${API}/funcionario/documentos/12/resolucion`,async r=>{
        cuerpos.push(r.request().postDataJSON());
        detalle = {...detalle,estadoSolicitud:'VALIDA',documentos:detalle.documentos.map(d=>d.id==='12'?{...d,estado:'VALIDO',resultados:[{estado:'valido',mensaje:'Revisado por la funcionaria.'}]}:d)};
        await r.fulfill({status:201,json:{ok:true,estadoSolicitud:'VALIDA'}});
    });
    await page.goto(DETALLE);
    await expect(page.getByRole('button',{name:/Marcar válido/})).toHaveCount(1);
    await page.getByRole('button',{name:'Marcar válido: Paz y Salvo de Biblioteca'}).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await revisarAxe(page);
    expect(cuerpos).toHaveLength(0);
    await dialogo.getByRole('button',{name:'Confirmar'}).click();
    await expect(page.getByRole('status')).toContainText('Documento resuelto');
    expect(cuerpos).toEqual([{resultado:'VALIDO'}]);
    await expect(page.getByRole('button',{name:/Marcar válido/})).toHaveCount(0);
    await expect(page.getByText('Estado:')).toContainText('Válida');
});

test('marcar no válido exige el motivo antes de enviar', async ({page}) => {
    await sesionComo(page,'funcionario');
    await page.route(`${API}/funcionario/solicitudes/1`,r=>r.fulfill({json:conPorRevisar()}));
    const cuerpos: unknown[] = [];
    await page.route(`${API}/funcionario/documentos/12/resolucion`,async r=>{
        cuerpos.push(r.request().postDataJSON());
        await r.fulfill({status:201,json:{ok:true,estadoSolicitud:'NO_VALIDA'}});
    });
    await page.goto(DETALLE);
    await page.getByRole('button',{name:'Marcar no válido: Paz y Salvo de Biblioteca'}).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByRole('button',{name:'Confirmar'}).click();
    await expect(dialogo.getByRole('alert')).toHaveText('Escribe el motivo.');
    expect(cuerpos).toHaveLength(0);
    await dialogo.getByLabel('Motivo (obligatorio)').fill('El certificado no corresponde al estudiante.');
    await dialogo.getByRole('button',{name:'Confirmar'}).click();
    await expect(dialogo).toBeHidden();
    expect(cuerpos).toEqual([{resultado:'NO_VALIDO',comentario:'El certificado no corresponde al estudiante.'}]);
});
