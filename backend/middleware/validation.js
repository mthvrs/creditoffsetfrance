/**
 * Validation Middleware with XSS Sanitization
 * Uses express-validator for validation and custom sanitizer for XSS protection
 */

import { body, validationResult } from 'express-validator';
import { 
  sanitizeText, 
  sanitizeUsername, 
  sanitizeTimecode,
  sanitizePostCreditScenes,
  sanitizeInt
} from '../utils/sanitizer.js';

function validateTimecode(timecode, fieldName) {
  if (!timecode) return null;
  
  const sanitized = sanitizeTimecode(timecode);
  
  if (!sanitized) {
    return `${fieldName}: Format invalide (HH:MM:SS attendu)`;
  }
  
  const pattern = /^(\d{1,2}):(\d{2}):(\d{2})$/;
  const match = sanitized.match(pattern);
  
  if (!match) {
    return `${fieldName}: Format invalide (HH:MM:SS attendu)`;
  }
  
  const [, hours, minutes, seconds] = match.map(Number);
  
  if (hours > 20) {
    return `${fieldName}: Les heures ne peuvent pas dépasser 20`;
  }
  if (minutes > 59) {
    return `${fieldName}: Les minutes doivent être entre 0 et 59`;
  }
  if (seconds > 59) {
    return `${fieldName}: Les secondes doivent être entre 0 et 59`;
  }
  if (sanitized === '00:00:00' || sanitized === '0:00:00') {
    return `${fieldName}: Ne peut pas être 00:00:00`;
  }
  
  return null;
}

export const validateSubmission = [
  body("tmdb_id")
    .isInt().withMessage('ID TMDB invalide')
    .toInt(),
  
  body('title')
    .trim()
    .notEmpty().withMessage('Titre requis')
    .custom((value) => {
      const sanitized = sanitizeText(value);
      if (!sanitized) throw new Error('Titre invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeText(value)),
  
  body("cpl_title")
    .trim()
    .notEmpty().withMessage('Titre CPL/Version requis')
    .isLength({ max: 500 }).withMessage('Titre CPL trop long (max 500 caractères)')
    .custom((value) => {
      const sanitized = sanitizeText(value);
      if (!sanitized) throw new Error('Titre CPL invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeText(value)),
  
  body('version')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Version trop longue (max 200 caractères)')
    .custom((value) => {
      if (!value) return true;
      const sanitized = sanitizeText(value);
      if (!sanitized) throw new Error('Version invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeText(value)),
  
  body('source')
    .isIn(['Observation en salle', 'Inclus dans le DCP', 'Communications du distributeur/labo', 'Autre'])
    .withMessage('Source invalide'),
  
  body('source_other')
    .if(body('source').equals('Autre'))
    .trim()
    .notEmpty().withMessage('Veuillez préciser la source')
    .isLength({ max: 200 }).withMessage('Source autre trop longue (max 200 caractères)')
    .custom((value) => {
      const sanitized = sanitizeText(value);
      if (!sanitized) throw new Error('Source invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeText(value)),
  
  body('ffec')
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true;
      const error = validateTimecode(value, 'FFEC');
      if (error) throw new Error(error);
      return true;
    })
    .customSanitizer((value) => sanitizeTimecode(value)),
  
  body('ffmc')
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true;
      const error = validateTimecode(value, 'FFMC');
      if (error) throw new Error(error);
      return true;
    })
    .customSanitizer((value) => sanitizeTimecode(value)),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes trop longues (max 1000 caractères)')
    .custom((value) => {
      if (!value) return true;
      const sanitized = sanitizeText(value);
      if (!sanitized) throw new Error('Notes invalides');
      return true;
    })
    .customSanitizer((value) => sanitizeText(value)),
  
  body('username')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Nom d'utilisateur trop long (max 100 caractères)")
    .custom((value) => {
      if (!value) return true;
      const sanitized = sanitizeUsername(value);
      if (!sanitized) throw new Error('Nom d\'utilisateur invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeUsername(value)),
  
  body("post_credit_scenes")
    .optional()
    .isArray().withMessage('Scènes post-générique invalides')
    .custom((scenes) => {
      if (!scenes) return true;
      
      const sanitized = sanitizePostCreditScenes(scenes);
      
      for (const scene of sanitized) {
        if (!scene.start_time || !scene.end_time) {
          throw new Error('Chaque scène doit avoir un start_time et end_time');
        }
        
        const startError = validateTimecode(scene.start_time, 'Start time');
        if (startError) throw new Error(startError);
        
        const endError = validateTimecode(scene.end_time, 'End time');
        if (endError) throw new Error(endError);
      }
      
      return true;
    })
    .customSanitizer((value) => sanitizePostCreditScenes(value)),
];

export const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  next();
};

export const validateComment = [
  body('username')
    .trim()
    .notEmpty().withMessage("Nom d'utilisateur requis")
    .isLength({ max: 100 }).withMessage("Nom d'utilisateur trop long (max 100 caractères)")
    .custom((value) => {
      const sanitized = sanitizeUsername(value);
      if (!sanitized) throw new Error('Nom d\'utilisateur invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeUsername(value)),
  
  body("comment_text")
    .trim()
    .notEmpty().withMessage('Commentaire requis')
    .isLength({ max: 1000 }).withMessage('Commentaire trop long (max 1000 caractères)')
    .custom((value) => {
      const sanitized = sanitizeText(value);
      if (!sanitized) throw new Error('Commentaire invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeText(value)),
];

export const validateReport = [
  body('reason')
    .trim()
    .notEmpty().withMessage('Raison requise')
    .isLength({ max: 500 }).withMessage('Raison trop longue (max 500 caractères)')
    .custom((value) => {
      const sanitized = sanitizeText(value);
      if (!sanitized) throw new Error('Raison invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeText(value)),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Adresse email invalide')
    .normalizeEmail(),
];

export const validateIpBan = [
  body("ip_address")
    .trim()
    .notEmpty().withMessage('Adresse IP requise')
    .isIP().withMessage('Adresse IP invalide'),
  
  body('reason')
    .trim()
    .notEmpty().withMessage('Raison requise')
    .isLength({ max: 500 }).withMessage('Raison trop longue (max 500 caractères)')
    .custom((value) => {
      const sanitized = sanitizeText(value);
      if (!sanitized) throw new Error('Raison invalide');
      return true;
    })
    .customSanitizer((value) => sanitizeText(value)),
];

export const sanitizeCommentData = (req, res, next) => {
  if (req.body.username) {
    req.body.username = sanitizeUsername(req.body.username);
  }
  if (req.body.comment_text) {
    req.body.comment_text = sanitizeText(req.body.comment_text);
  }
  next();
};

export const sanitizeReportData = (req, res, next) => {
  if (req.body.reason) {
    req.body.reason = sanitizeText(req.body.reason);
  }
  next();
};
