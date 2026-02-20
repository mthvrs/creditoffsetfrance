import axios from 'axios';
import logger from './logger.js';

const WEBHOOKS = {
  submissions: process.env.DISCORD_WEBHOOK_FILMS,  // CHANGE: Use FILMS
  comments: process.env.DISCORD_WEBHOOK_COMMENTS,   // ADD THIS
  likes: process.env.DISCORD_WEBHOOK_LIKES,         // ADD THIS
  reports: process.env.DISCORD_WEBHOOK_REPORTS,
  moderation: process.env.DISCORD_WEBHOOK_MODERATION || process.env.DISCORD_WEBHOOK_REPORTS,
  admin: process.env.DISCORD_WEBHOOK_ADMIN || process.env.DISCORD_WEBHOOK_FILMS,  // CHANGE: fallback to FILMS
};

/**
 * Sends a message to Discord webhook with retry logic for rate limits
 * @param {string} type - Type of webhook (submissions, comments, likes, reports, moderation, admin)
 * @param {object} embed - Discord embed object
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<void>}
 */
export async function sendDiscordWebhook(type, embed, retryCount = 0) {
  const webhookUrl = WEBHOOKS[type];
  
  if (!webhookUrl) {
    logger.warn(`Discord webhook URL not configured for type: ${type}`);
    return;
  }

  try {
    await axios.post(webhookUrl, {
      embeds: [embed],
    });
  } catch (error) {
    // Handle rate limiting (429)
    if (error.response?.status === 429 && retryCount < 3) {
      const retryAfter = error.response.data?.retry_after || (retryCount + 1) * 2000;
      logger.info(`Discord rate limited. Retrying in ${retryAfter}ms (attempt ${retryCount + 1}/3)`);
      
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return sendDiscordWebhook(type, embed, retryCount + 1);
    }
    
    logger.error(`Discord webhook error (${type}):`, { error: error.response?.data || error.message });
  }
}

/**
 * Batch send multiple Discord webhooks with rate limit handling
 * @param {string} type - Type of webhook
 * @param {object[]} embeds - Array of Discord embed objects
 * @returns {Promise<void>}
 */
export async function sendDiscordWebhookBatch(type, embeds) {
  const webhookUrl = WEBHOOKS[type];
  
  if (!webhookUrl) {
    logger.warn(`Discord webhook URL not configured for type: ${type}`);
    return;
  }

  for (let i = 0; i < embeds.length; i++) {
    await sendDiscordWebhook(type, embeds[i]);
    
    if (i < embeds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

export default sendDiscordWebhook;
