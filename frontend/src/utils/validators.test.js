import { validateTimeFormat } from './validators';

describe('validateTimeFormat', () => {
  test('validates correct time format', () => {
    expect(validateTimeFormat('1:23:45').valid).toBe(true);
    expect(validateTimeFormat('12:34:56').valid).toBe(true);
    expect(validateTimeFormat('0:00:00').valid).toBe(true);
    expect(validateTimeFormat('20:59:59').valid).toBe(true);
  });

  test('trims whitespace', () => {
    expect(validateTimeFormat('  1:23:45  ').valid).toBe(true);
  });

  test('invalidates incorrect format', () => {
    expect(validateTimeFormat('invalid').valid).toBe(false);
    expect(validateTimeFormat('123:45:67').valid).toBe(false);
    expect(validateTimeFormat('12:34').valid).toBe(false);
    expect(validateTimeFormat('12:34:56:78').valid).toBe(false);
  });

  test('invalidates hours > 20', () => {
    expect(validateTimeFormat('21:00:00').valid).toBe(false);
    expect(validateTimeFormat('21:00:00').error).toBe('Les heures ne peuvent pas dépasser 20');
  });

  test('invalidates minutes > 59', () => {
    expect(validateTimeFormat('0:60:00').valid).toBe(false);
    expect(validateTimeFormat('0:60:00').error).toBe('Les minutes doivent être entre 0 et 59');
  });

  test('invalidates seconds > 59', () => {
    expect(validateTimeFormat('0:00:60').valid).toBe(false);
    expect(validateTimeFormat('0:00:60').error).toBe('Les secondes doivent être entre 0 et 59');
  });

  test('invalidates empty input', () => {
    expect(validateTimeFormat('').valid).toBe(false);
    expect(validateTimeFormat(null).valid).toBe(false);
  });
});
