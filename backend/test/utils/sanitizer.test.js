import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sanitizeTimecode } from '../../utils/sanitizer.js';

describe('sanitizeTimecode', () => {
  // Happy paths
  test('should return sanitized timecode for valid input', () => {
    assert.strictEqual(sanitizeTimecode('00:00:00'), '00:00:00');
    assert.strictEqual(sanitizeTimecode('01:23:45'), '01:23:45');
    assert.strictEqual(sanitizeTimecode('1:23:45'), '1:23:45');
  });

  // Invalid types
  test('should return empty string for non-string or empty input', () => {
    assert.strictEqual(sanitizeTimecode(''), '');
    assert.strictEqual(sanitizeTimecode(null), '');
    assert.strictEqual(sanitizeTimecode(undefined), '');
    assert.strictEqual(sanitizeTimecode(12345), '');
    assert.strictEqual(sanitizeTimecode({}), '');
  });

  // Invalid formats
  test('should return empty string for invalid format', () => {
    assert.strictEqual(sanitizeTimecode('invalid'), '');
    assert.strictEqual(sanitizeTimecode('12:34'), ''); // missing seconds
    assert.strictEqual(sanitizeTimecode('1:2:3'), ''); // single digits
    assert.strictEqual(sanitizeTimecode('01:23:45:67'), ''); // extra part
    assert.strictEqual(sanitizeTimecode('ab:cd:ef'), ''); // non-digits
  });

  // Edge cases - Minutes/Seconds >= 60
  test('should return empty string for minutes >= 60', () => {
    assert.strictEqual(sanitizeTimecode('00:60:00'), '');
    assert.strictEqual(sanitizeTimecode('00:99:00'), '');
  });

  test('should return empty string for seconds >= 60', () => {
    assert.strictEqual(sanitizeTimecode('00:00:60'), '');
    assert.strictEqual(sanitizeTimecode('00:00:99'), '');
  });

  test('should handle edge cases where minutes and seconds are just below 60', () => {
     assert.strictEqual(sanitizeTimecode('00:59:59'), '00:59:59');
  });

  // Sanitization behavior
  test('should strip whitespace', () => {
    assert.strictEqual(sanitizeTimecode(' 01:00:00 '), '01:00:00');
  });

  test('should strip negative signs', () => {
    // Current implementation strips non-whitelisted chars, so - becomes empty,
    // leaving valid timecode if strictly formatted, or if it disrupts format it fails.
    // '-01:00:00' -> '01:00:00'
    assert.strictEqual(sanitizeTimecode('-01:00:00'), '01:00:00');
  });

});
