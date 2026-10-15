import {
  AcademicLevel,
  CrossValidationOutcome,
  CrossValidationSource,
  DocumentClassification,
  JobStatus,
  RequestStatus,
  RequiredAction,
  RuleResult,
  SubmissionType,
  TypeDocument,
  ValidationStatus,
} from './enums.js';

// Los valores son el contrato con el trabajador de Python y el frontend: cambiarlos rompe a los dos.
describe('enums de los contratos', () => {
  it('TypeDocument', () => {
    expect(TypeDocument.options).toEqual([
      'identification',
      'academic_evaluation',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
      'saber_pro',
    ]);
  });

  it('AcademicLevel', () => {
    expect(AcademicLevel.options).toEqual(['pregrado', 'posgrado']);
  });

  it('JobStatus', () => {
    expect(JobStatus.options).toEqual(['queued', 'processing', 'completed', 'failed', 'retry_pending']);
  });

  it('RequestStatus', () => {
    expect(RequestStatus.options).toEqual([
      'queued',
      'processing',
      'awaiting_review',
      'correction_required',
      'ready_for_formal_submission',
      'closed',
    ]);
  });

  it('RuleResult', () => {
    expect(RuleResult.options).toEqual(['cumple', 'no_cumple', 'no_evaluable']);
  });

  it('DocumentClassification', () => {
    expect(DocumentClassification.options).toEqual(['valid', 'invalid', 'inconsistent', 'to_check']);
  });

  it('ValidationStatus', () => {
    expect(ValidationStatus.options).toEqual(['pending', 'processing', 'completed', 'failed']);
  });

  it('RequiredAction', () => {
    expect(RequiredAction.options).toEqual([
      'none',
      'upload_new_version',
      'wait_for_review',
      'wait_for_external_validation',
      'wait_for_processing',
      'correct_data',
      'contact_administration',
    ]);
  });

  it('CrossValidationOutcome', () => {
    expect(CrossValidationOutcome.options).toEqual([
      'confirmed_match',
      'confirmed_mismatch',
      'insufficient_information',
      'source_pending',
      'source_unavailable',
      'manual_review_required',
    ]);
  });

  it('CrossValidationSource', () => {
    expect(CrossValidationSource.options).toEqual([
      'identification',
      'academic_evaluation',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
      'saber_pro',
      'application_data',
      'banner',
      'rui',
    ]);
  });

  it('SubmissionType', () => {
    expect(SubmissionType.options).toEqual(['initial', 'resubmission']);
  });
});
