import axios from 'axios';
import logger from './logger.js';
import { sendDiscordWebhook } from './discord.js';

class TMDBStatusMonitor {
  constructor() {
    this.statusCache = {
      hasIssues: false,
      services: {
        api: { status: 'Unknown', description: '' },
        image: { status: 'Unknown', description: '' }
      },
      lastChecked: null,
      lastUpdated: null
    };
    
    this.previousStatus = {
      api: 'Unknown',
      image: 'Unknown'
    };
    
    this.pollInterval = null;
    this.isPolling = false;
    
    // Configuration
    this.RSS_URL = 'https://status.themoviedb.org/rss';
    this.POLL_INTERVAL = parseInt(process.env.TMDB_STATUS_CHECK_INTERVAL) || 300000; // 5 minutes default
    this.USE_MOCK = process.env.MOCK_TMDB_STATUS === 'true';
  }

  /**
   * Start monitoring TMDB status
   */
  start() {
    if (this.isPolling) {
      logger.warn('TMDB Status Monitor already running');
      return;
    }

    logger.info(`Starting TMDB Status Monitor (interval: ${this.POLL_INTERVAL / 1000}s)`);
    this.isPolling = true;

    // Check immediately on startup
    this.checkStatus();

    // Then poll at regular intervals
    this.pollInterval = setInterval(() => {
      this.checkStatus();
    }, this.POLL_INTERVAL);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.isPolling = false;
      logger.info('TMDB Status Monitor stopped');
    }
  }

  /**
   * Get current status (used by API endpoint)
   */
  getStatus() {
    return {
      ...this.statusCache,
      message: this.generateUserMessage()
    };
  }

  /**
   * Main status check function
   */
  async checkStatus() {
    try {
      logger.info('Checking TMDB status...');

      let statusData;
      
      if (this.USE_MOCK) {
        statusData = this.getMockStatus();
      } else {
        statusData = await this.fetchRSSFeed();
      }

      // Update cache
      this.updateCache(statusData);

      // Check for status changes and log to Discord
      await this.detectAndLogChanges(statusData);

      logger.info('TMDB status check complete', {
        api: statusData.api.status,
        image: statusData.image.status,
        hasIssues: statusData.api.status !== 'Operational' || statusData.image.status !== 'Operational'
      });

    } catch (error) {
      logger.error('Failed to check TMDB status', {
        error: error.message,
        stack: error.stack
      });
      // Keep last known status on error
    }
  }

  /**
   * Fetch and parse RSS feed
   */
  async fetchRSSFeed() {
    const response = await axios.get(this.RSS_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'CreditOffsetFrance-StatusMonitor/1.0'
      }
    });

    return this.parseRSSFeed(response.data);
  }

  /**
   * Parse RSS XML and extract TMDB-API and TMDB-IMAGE status
   */
  parseRSSFeed(xmlData) {
    const apiMatch = xmlData.match(/<item>[\s\S]*?<title>tmdb-api\s*-\s*([^<]+)<\/title>[\s\S]*?<description>([^<]*)<\/description>[\s\S]*?<\/item>/i);
    const imageMatch = xmlData.match(/<item>[\s\S]*?<title>tmdb-image\s*-\s*([^<]+)<\/title>[\s\S]*?<description>([^<]*)<\/description>[\s\S]*?<\/item>/i);

    const apiStatus = apiMatch ? apiMatch[1].trim() : 'Unknown';
    const apiDescription = apiMatch ? apiMatch[2].trim() : '';
    
    const imageStatus = imageMatch ? imageMatch[1].trim() : 'Unknown';
    const imageDescription = imageMatch ? imageMatch[2].trim() : '';

    return {
      api: {
        status: apiStatus,
        description: apiDescription
      },
      image: {
        status: imageStatus,
        description: imageDescription
      }
    };
  }

  /**
   * Update internal cache
   */
  updateCache(statusData) {
    const hasIssues = 
      statusData.api.status !== 'Operational' || 
      statusData.image.status !== 'Operational';

    this.statusCache = {
      hasIssues,
      services: statusData,
      lastChecked: new Date().toISOString(),
      lastUpdated: hasIssues !== this.statusCache.hasIssues ? new Date().toISOString() : this.statusCache.lastUpdated
    };
  }

  /**
   * Detect status changes and log to Discord
   */
  async detectAndLogChanges(statusData) {
    const apiChanged = this.previousStatus.api !== statusData.api.status && this.previousStatus.api !== 'Unknown';
    const imageChanged = this.previousStatus.image !== statusData.image.status && this.previousStatus.image !== 'Unknown';

    if (apiChanged) {
      await this.logStatusChange('TMDB-API', this.previousStatus.api, statusData.api.status, statusData.api.description);
    }

    if (imageChanged) {
      await this.logStatusChange('TMDB-IMAGE', this.previousStatus.image, statusData.image.status, statusData.image.description);
    }

    // Update previous status
    this.previousStatus.api = statusData.api.status;
    this.previousStatus.image = statusData.image.status;
  }

  /**
   * Log status change to Discord admin webhook
   */
  async logStatusChange(serviceName, oldStatus, newStatus, description) {
    try {
      const isNowHealthy = newStatus === 'Operational';
      const wasHealthy = oldStatus === 'Operational';

      // Only log if changing to/from operational
      if (isNowHealthy === wasHealthy) return;

      const color = isNowHealthy ? 3066993 : 15158332; // Green for healthy, red for issues
      const emoji = isNowHealthy ? '✅' : '🔴';

      await sendDiscordWebhook('admin', {
        title: `${emoji} TMDB Status Alert`,
        color,
        fields: [
          {
            name: '🔧 Service',
            value: serviceName,
            inline: true
          },
          {
            name: '📊 Status',
            value: `${oldStatus} → **${newStatus}**`,
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true
          },
          {
            name: '📝 Description',
            value: description || 'Aucune description',
            inline: false
          },
          {
            name: '🕐 Détecté',
            value: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
            inline: true
          }
        ],
        timestamp: new Date().toISOString()
      });

      logger.info(`Discord webhook sent for ${serviceName} status change`);
    } catch (error) {
      logger.error('Failed to send Discord webhook for status change', {
        error: error.message,
        service: serviceName
      });
    }
  }

  /**
   * Generate user-friendly message in French
   */
  generateUserMessage() {
    const apiHasIssues = this.statusCache.services.api.status !== 'Operational';
    const imageHasIssues = this.statusCache.services.image.status !== 'Operational';

    if (apiHasIssues && imageHasIssues) {
      return "TMDB rencontre des problèmes. L'ajout de nouveaux films et l'affichage des affiches peuvent ne pas fonctionner correctement.";
    } else if (apiHasIssues) {
      return "L'API TMDB connaît des problèmes. L'ajout de nouveaux films pourrait échouer temporairement.";
    } else if (imageHasIssues) {
      return "Le service d'images TMDB ne fonctionne pas correctement. Les affiches peuvent ne pas s'afficher.";
    }

    return '';
  }

  /**
   * Get mock status for testing
   */
  getMockStatus() {
    const apiStatus = process.env.MOCK_TMDB_API_STATUS || 'Operational';
    const imageStatus = process.env.MOCK_TMDB_IMAGE_STATUS || 'Operational';

    return {
      api: {
        status: apiStatus,
        description: `tmdb-api is ${apiStatus}`
      },
      image: {
        status: imageStatus,
        description: `tmdb-image is ${imageStatus}`
      }
    };
  }
}

// Create singleton instance
const statusMonitor = new TMDBStatusMonitor();

export default statusMonitor;
