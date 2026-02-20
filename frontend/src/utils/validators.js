/**
 * Validates a time string format (H:MM:SS or HH:MM:SS)
 * @param {string} time - The time string to validate
 * @returns {{valid: boolean, error?: string}} - Validation result object
 */
export const validateTimeFormat = (time) => {
  if (!time) {
    return { valid: false, error: 'Time is required' };
  }

  // Trim whitespace before validation
  const trimmedTime = time.trim();

  if (!/^[0-9]{1,2}:[0-9]{2}:[0-9]{2}$/.test(trimmedTime)) {
    return { valid: false, error: 'Format invalide. Utilisez H:MM:SS ou HH:MM:SS' };
  }

  const [hours, minutes, seconds] = trimmedTime.split(':').map(Number);

  if (hours > 20) {
    return { valid: false, error: 'Les heures ne peuvent pas dépasser 20' };
  }

  if (minutes > 59) {
    return { valid: false, error: 'Les minutes doivent être entre 0 et 59' };
  }

  if (seconds > 59) {
    return { valid: false, error: 'Les secondes doivent être entre 0 et 59' };
  }

  return { valid: true };
};

export default {
  validateTimeFormat
};
