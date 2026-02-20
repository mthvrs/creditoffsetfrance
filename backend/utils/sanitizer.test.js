import { sanitizePostCreditScenes } from './sanitizer.js';

describe('sanitizePostCreditScenes', () => {
  test('should return empty array for non-array input', () => {
    expect(sanitizePostCreditScenes(null)).toEqual([]);
    expect(sanitizePostCreditScenes(undefined)).toEqual([]);
    expect(sanitizePostCreditScenes('invalid')).toEqual([]);
    expect(sanitizePostCreditScenes(123)).toEqual([]);
    expect(sanitizePostCreditScenes({})).toEqual([]);
  });

  test('should return empty array for empty array input', () => {
    expect(sanitizePostCreditScenes([])).toEqual([]);
  });

  test('should handle valid scenes correctly', () => {
    const scenes = [
      {
        start_time: '01:00:00',
        end_time: '01:00:10',
        description: 'A funny scene.',
        scene_order: 1
      }
    ];
    const sanitized = sanitizePostCreditScenes(scenes);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]).toEqual({
      start_time: '01:00:00',
      end_time: '01:00:10',
      description: 'A funny scene.',
      scene_order: 1
    });
  });

  test('should filter out invalid scenes (missing times)', () => {
    const scenes = [
      {
        start_time: '',
        end_time: '01:00:10',
        description: 'Invalid start time'
      },
      {
        start_time: '01:00:00',
        end_time: '',
        description: 'Invalid end time'
      }
    ];
    expect(sanitizePostCreditScenes(scenes)).toEqual([]);
  });

  test('should handle null/undefined elements in scenes array without crashing', () => {
    const scenes = [null, undefined, {}];
    // This is expected to fail currently
    expect(sanitizePostCreditScenes(scenes)).toEqual([]);
  });

  test('should handle mixed valid and invalid elements', () => {
    const scenes = [
      null,
      {
        start_time: '01:00:00',
        end_time: '01:00:10',
        description: 'Valid scene',
        scene_order: 1
      },
      undefined
    ];
    const result = sanitizePostCreditScenes(scenes);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Valid scene');
  });
});
