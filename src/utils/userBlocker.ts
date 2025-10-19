import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import SecurityLogger from './securityLogger';

const logger = new Logger('UserBlocker');

interface BlockedUser {
  userId: number;
  username?: string;
  reason: string;
  blockedAt: string;
  blockedBy?: number; // Admin user ID
  expiresAt?: string; // Optional: temporary blocks
}

interface BlockList {
  users: BlockedUser[];
  lastUpdated: string;
}

/**
 * User blocking system to prevent abusive users from interacting with the bot
 */
export class UserBlocker {
  private blockListFile: string;
  private blockedUsers: Map<number, BlockedUser> = new Map();

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.blockListFile = path.join(dataDir, 'blocked-users.json');
    this.loadBlockList();
  }

  /**
   * Load block list from file
   */
  private loadBlockList(): void {
    try {
      if (fs.existsSync(this.blockListFile)) {
        const data = fs.readFileSync(this.blockListFile, 'utf-8');
        const blockList: BlockList = JSON.parse(data);

        // Load into Map and clean expired blocks
        const now = new Date();
        blockList.users.forEach(user => {
          if (user.expiresAt) {
            const expiry = new Date(user.expiresAt);
            if (expiry > now) {
              this.blockedUsers.set(user.userId, user);
            }
          } else {
            this.blockedUsers.set(user.userId, user);
          }
        });

        logger.info(`Loaded ${this.blockedUsers.size} blocked users`);
      } else {
        logger.info('No existing block list found, starting fresh');
      }
    } catch (error) {
      logger.error('Failed to load block list:', error);
      SecurityLogger.logEvent({
        eventType: 'BLOCK_LIST_LOAD_ERROR',
        severity: 'medium',
        description: 'Failed to load block list',
        metadata: { error: String(error) },
      });
    }
  }

  /**
   * Save block list to file
   */
  private saveBlockList(): void {
    try {
      const blockList: BlockList = {
        users: Array.from(this.blockedUsers.values()),
        lastUpdated: new Date().toISOString(),
      };

      fs.writeFileSync(this.blockListFile, JSON.stringify(blockList, null, 2), 'utf-8');
      logger.info(`Saved ${blockList.users.length} blocked users to file`);
    } catch (error) {
      logger.error('Failed to save block list:', error);
      SecurityLogger.logEvent({
        eventType: 'BLOCK_LIST_SAVE_ERROR',
        severity: 'medium',
        description: 'Failed to save block list',
        metadata: { error: String(error) },
      });
    }
  }

  /**
   * Check if a user is blocked
   */
  isBlocked(userId: number): boolean {
    const blockedUser = this.blockedUsers.get(userId);

    if (!blockedUser) {
      return false;
    }

    // Check if block has expired
    if (blockedUser.expiresAt) {
      const expiry = new Date(blockedUser.expiresAt);
      if (expiry <= new Date()) {
        logger.info(`Block expired for user ${userId}, removing from block list`);
        this.unblockUser(userId);
        return false;
      }
    }

    return true;
  }

  /**
   * Block a user permanently
   */
  blockUser(userId: number, reason: string, adminId?: number, username?: string): void {
    if (this.blockedUsers.has(userId)) {
      logger.warn(`User ${userId} is already blocked`);
      return;
    }

    const blockedUser: BlockedUser = {
      userId,
      username,
      reason,
      blockedAt: new Date().toISOString(),
      blockedBy: adminId,
    };

    this.blockedUsers.set(userId, blockedUser);
    this.saveBlockList();

    logger.warn(`Blocked user ${userId} (${username || 'unknown'}) - Reason: ${reason}`);
    SecurityLogger.logEvent({
      eventType: 'USER_BLOCKED',
      severity: 'high',
      description: `User ${userId} (${username || 'unknown'}) blocked: ${reason}`,
      userId: userId,
      metadata: {
        reason,
        blockedBy: adminId,
        username,
      },
    });
  }

  /**
   * Block a user temporarily
   */
  blockUserTemporary(
    userId: number,
    reason: string,
    durationMinutes: number,
    adminId?: number,
    username?: string
  ): void {
    if (this.blockedUsers.has(userId)) {
      logger.warn(`User ${userId} is already blocked`);
      return;
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    const blockedUser: BlockedUser = {
      userId,
      username,
      reason,
      blockedAt: new Date().toISOString(),
      blockedBy: adminId,
      expiresAt: expiresAt.toISOString(),
    };

    this.blockedUsers.set(userId, blockedUser);
    this.saveBlockList();

    logger.warn(
      `Temporarily blocked user ${userId} (${username || 'unknown'}) for ${durationMinutes} minutes - Reason: ${reason}`
    );
    SecurityLogger.logEvent({
      eventType: 'USER_BLOCKED_TEMPORARY',
      severity: 'high',
      description: `User ${userId} (${username || 'unknown'}) blocked for ${durationMinutes} minutes: ${reason}`,
      userId: userId,
      metadata: {
        reason,
        durationMinutes,
        expiresAt: expiresAt.toISOString(),
        blockedBy: adminId,
        username,
      },
    });
  }

  /**
   * Unblock a user
   */
  unblockUser(userId: number, adminId?: number): boolean {
    const blockedUser = this.blockedUsers.get(userId);
    if (!blockedUser) {
      logger.warn(`Cannot unblock user ${userId} - not in block list`);
      return false;
    }

    this.blockedUsers.delete(userId);
    this.saveBlockList();

    logger.info(`Unblocked user ${userId} (${blockedUser.username || 'unknown'})`);
    SecurityLogger.logEvent({
      eventType: 'USER_UNBLOCKED',
      severity: 'medium',
      description: `User ${userId} (${blockedUser.username || 'unknown'}) unblocked`,
      userId: userId,
      metadata: {
        unblockedBy: adminId,
        username: blockedUser.username,
        originalReason: blockedUser.reason,
      },
    });

    return true;
  }

  /**
   * Get blocked user info
   */
  getBlockedUserInfo(userId: number): BlockedUser | undefined {
    return this.blockedUsers.get(userId);
  }

  /**
   * Get all blocked users
   */
  getAllBlockedUsers(): BlockedUser[] {
    return Array.from(this.blockedUsers.values());
  }

  /**
   * Get block list statistics
   */
  getStats(): {
    totalBlocked: number;
    permanentBlocks: number;
    temporaryBlocks: number;
    expiredBlocks: number;
  } {
    const now = new Date();
    let permanentBlocks = 0;
    let temporaryBlocks = 0;
    let expiredBlocks = 0;

    this.blockedUsers.forEach(user => {
      if (user.expiresAt) {
        const expiry = new Date(user.expiresAt);
        if (expiry <= now) {
          expiredBlocks++;
        } else {
          temporaryBlocks++;
        }
      } else {
        permanentBlocks++;
      }
    });

    return {
      totalBlocked: this.blockedUsers.size,
      permanentBlocks,
      temporaryBlocks,
      expiredBlocks,
    };
  }

  /**
   * Clean up expired blocks
   */
  cleanupExpiredBlocks(): number {
    const now = new Date();
    let cleaned = 0;

    this.blockedUsers.forEach((user, userId) => {
      if (user.expiresAt) {
        const expiry = new Date(user.expiresAt);
        if (expiry <= now) {
          this.blockedUsers.delete(userId);
          cleaned++;
        }
      }
    });

    if (cleaned > 0) {
      this.saveBlockList();
      logger.info(`Cleaned up ${cleaned} expired blocks`);
    }

    return cleaned;
  }
}

// Export singleton instance
export default new UserBlocker();
