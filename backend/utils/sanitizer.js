/**
 * XSS Sanitization Utility
 * Strips dangerous content but preserves normal text characters like apostrophes
 * HTML escaping is done by the frontend during rendering
 */

import validator from 'validator';

/**
 * Sanitize user input to plain text only
 * Strips HTML tags but preserves normal punctuation like apostrophes
 * Does NOT HTML-escape - that's the frontend's job during rendering
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized plain text
 */
export function sanitizeText(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim whitespace from edges only
  let sanitized = input.trim();
  
  // Remove HTML tags using whitelist (only allow safe characters, no tags)
  // This prevents <script> and other HTML injection but keeps punctuation
  sanitized = validator.stripLow(sanitized, true); // Remove control characters but keep newlines
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove HTML tags manually (simple approach - strips < and > and everything between)
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove any remaining HTML-like patterns
  sanitized = sanitized.replace(/&lt;/g, '').replace(/&gt;/g, '');
  
  return sanitized;
}

/**
 * Sanitize username - stricter rules
 * Allows only alphanumeric, spaces, hyphens, underscores, apostrophes and basic accented characters
 * @param {string} username - Raw username input
 * @returns {string} - Sanitized username
 */
export function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') {
    return '';
  }

  // First trim
  let sanitized = validator.trim(username);
  
  // Whitelist approach: only allow safe characters
  // Allows French accented characters and apostrophes: 'àâäéèêëïîôùûüÿç
  sanitized = validator.whitelist(
    sanitized, 
    'a-zA-Z0-9\\s\\-_\'\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ef\u00ee\u00f4\u00f9\u00fb\u00fc\u00ff\u00e7\u00c0\u00c2\u00c4\u00c9\u00c8\u00ca\u00cb\u00cf\u00ce\u00d4\u00d9\u00db\u00dc\u0178\u00c7'
  );
  
  // Normalize multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  return sanitized.trim();
}

/**
 * Sanitize IP address - ensure it's a valid format
 * @param {string} ip - Raw IP address
 * @returns {string} - Sanitized IP or empty string if invalid
 */
export function sanitizeIP(ip) {
  if (!ip || typeof ip !== 'string') {
    return '';
  }

  const trimmed = ip.trim();
  
  // Use validator's built-in IP validation
  if (validator.isIP(trimmed, 4) || validator.isIP(trimmed, 6)) {
    return trimmed;
  }
  
  return '';
}

/**
 * Sanitize timecode - ensure it's in valid format
 * @param {string} timecode - Raw timecode input
 * @returns {string} - Sanitized timecode or empty string if invalid
 */
export function sanitizeTimecode(timecode) {
  if (!timecode || typeof timecode !== 'string') {
    return '';
  }

  // Whitelist: only digits and colons
  let sanitized = validator.whitelist(timecode, '0-9:');
  
  // Validate format: HH:MM:SS or H:MM:SS
  const pattern = /^(\d{1,2}):(\d{2}):(\d{2})$/;
  
  if (!pattern.test(sanitized)) {
    return '';
  }
  
  // Additional validation: ensure valid time ranges
  const parts = sanitized.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  
  if (minutes >= 60 || seconds >= 60) {
    return '';
  }
  
  return sanitized;
}

/**
 * Sanitize email - validation and normalization
 * @param {string} email - Raw email input
 * @returns {string} - Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }

  const trimmed = validator.trim(email);
  
  // Use validator's email validation
  if (!validator.isEmail(trimmed)) {
    return '';
  }
  
  // Normalize email (lowercase, remove dots from Gmail, etc.)
  const normalized = validator.normalizeEmail(trimmed, {
    gmail_remove_dots: false, // Keep dots in Gmail addresses
    gmail_remove_subaddress: false, // Keep +tags
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false
  });
  
  return normalized || '';
}

/**
 * Sanitize URL - ensure it's valid and safe
 * @param {string} url - Raw URL input
 * @returns {string} - Sanitized URL or empty string if invalid
 */
export function sanitizeURL(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = validator.trim(url);
  
  // Validate URL format
  if (!validator.isURL(trimmed, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    allow_underscores: false
  })) {
    return '';
  }
  
  return trimmed;
}

/**
 * Sanitize an object with multiple fields
 * @param {Object} data - Object containing user input fields
 * @param {Object} schema - Schema defining how to sanitize each field
 * @returns {Object} - Sanitized object
 */
export function sanitizeObject(data, schema) {
  const sanitized = {};
  
  for (const [key, sanitizer] of Object.entries(schema)) {
    if (data[key] !== undefined && data[key] !== null) {
      if (typeof sanitizer === 'function') {
        sanitized[key] = sanitizer(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }
  }
  
  return sanitized;
}

/**
 * Sanitize post-credit scenes array
 * @param {Array} scenes - Array of post-credit scene objects
 * @returns {Array} - Sanitized array
 */
export function sanitizePostCreditScenes(scenes) {
  if (!Array.isArray(scenes)) {
    return [];
  }
  
  return scenes.filter(scene => scene && typeof scene === 'object').map(scene => {
    const start_time = sanitizeTimecode(scene.start_time || '');
    const end_time = sanitizeTimecode(scene.end_time || '');
    // sanitizeText now preserves apostrophes and normal punctuation
    const description = sanitizeText(scene.description || '');
    const scene_order = validator.isInt(String(scene.scene_order), { min: 0 }) 
      ? parseInt(scene.scene_order, 10) 
      : 0;
    
    return { start_time, end_time, description, scene_order };
  }).filter(scene => scene.start_time && scene.end_time);
}

/**
 * Truncate text to a maximum length safely
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength);
}

/**
 * Sanitize integer input
 * @param {any} value - Value to sanitize as integer
 * @param {Object} options - Options for validation (min, max)
 * @returns {number|null} - Sanitized integer or null if invalid
 */
export function sanitizeInt(value, options = {}) {
  if (value === undefined || value === null) {
    return null;
  }
  
  const str = String(value);
  
  if (!validator.isInt(str, options)) {
    return null;
  }
  
  return parseInt(str, 10);
}

/**
 * Sanitize boolean input
 * @param {any} value - Value to sanitize as boolean
 * @returns {boolean} - Sanitized boolean
 */
export function sanitizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    return validator.toBoolean(value, true); // strict mode
  }
  
  return false;
}

export default {
  sanitizeText,
  sanitizeUsername,
  sanitizeIP,
  sanitizeTimecode,
  sanitizeEmail,
  sanitizeURL,
  sanitizeObject,
  sanitizePostCreditScenes,
  sanitizeInt,
  sanitizeBoolean,
  truncate
};
