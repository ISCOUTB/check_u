/** Solo presentación: se conservan las claves originales del contrato. */
const ETIQUETAS: Record<string, string> = {
  code_student: 'Código estudiantil', full_name_student: 'Nombre completo del estudiante', full_name: 'Nombre completo',
  first_name: 'Nombres', last_name: 'Apellidos', identification_type: 'Tipo de documento', identification_number: 'Número de documento',
  birth_date: 'Fecha de nacimiento', sex: 'Sexo', receipt_number: 'Número de recibo', payment_date: 'Fecha de pago',
  pro_cultura_amount: 'Valor de la estampilla Pro-Cultura', registration_number: 'Número de registro', global_score: 'Puntaje global',
  score: 'Puntaje', test_date: 'Fecha de aplicación', exam_date: 'Fecha del examen', application_date: 'Fecha de aplicación',
  program: 'Programa académico', program_name: 'Programa académico', academic_program: 'Programa académico',
  max_credits: 'Créditos máximos', credits_approved: 'Créditos aprobados', general_result: 'Resultado general', motivo: 'Motivo del resultado',
  total_credits: 'Créditos totales', approved_credits: 'Créditos aprobados', pending_credits: 'Créditos pendientes',
  required_credits: 'Créditos requeridos', earned_credits: 'Créditos obtenidos', university: 'Universidad',
  snp: 'Número de registro Saber Pro', document_date: 'Fecha del documento', signature_valid: 'Firma verificada',
  graduation_requirements: 'Requisitos de grado', academic_status: 'Estado académico', is_complete: 'Cumplimiento de requisitos',
};
export const etiquetaPropiedad = (clave: string, indice: number) => ETIQUETAS[clave] ?? `Dato adicional ${indice + 1}`;
export const valorVisible = (v: string | number | boolean | null) => v === null ? 'No disponible' : typeof v === 'boolean' ? v ? 'Sí' : 'No' : String(v);
