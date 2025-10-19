import { Context } from 'telegraf';
import { Logger } from '../utils/logger';
import SecurityLogger from '../utils/securityLogger';
import errorMonitor from '../utils/errorMonitor';
import userBlocker from '../utils/userBlocker';
import InputValidator from '../utils/inputValidator';
import config from '../config';

const logger = new Logger('BlockCommands');

export class BlockCommands {
  /**
   * /block - Block a user from using the bot (Admin only)
   * Usage: /block <user_id> <reason>
   * Usage: /block <user_id> <duration_minutes> <reason> (temporary block)
   */
  async block(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || 'unknown';

      if (!userId) return;

      // Check if user is admin
      if (!config.adminIds.includes(userId)) {
        await ctx.reply('⛔ This command is only available to administrators.');
        SecurityLogger.logUnauthorizedAccess('/block command', userId, username, chatId);
        return;
      }

      const messageText = (ctx.message as any)?.text || '';
      const parts = messageText.split(' ').slice(1); // Remove '/block'

      if (parts.length < 2) {
        await ctx.reply(
          '❌ Invalid usage.\n\n' +
          '*Usage:*\n' +
          '`/block <user_id> <reason>` - Permanent block\n' +
          '`/block <user_id> <duration_minutes> <reason>` - Temporary block\n\n' +
          '*Examples:*\n' +
          '`/block 123456789 Spam and abuse`\n' +
          '`/block 123456789 60 Temporary timeout for excessive requests`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const targetUserId = parseInt(parts[0], 10);
      if (isNaN(targetUserId)) {
        await ctx.reply('❌ Invalid user ID. Please provide a numeric user ID.');
        return;
      }

      // Check if trying to block another admin
      if (config.adminIds.includes(targetUserId)) {
        await ctx.reply('⛔ Cannot block another administrator.');
        SecurityLogger.logEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'high',
          description: `Admin ${userId} (${username || 'unknown'}) attempted to block another admin ${targetUserId}`,
          userId: userId,
          metadata: {
            targetUserId,
            adminUsername: username,
            command: 'block_admin',
          },
        });
        return;
      }

      // Check if second parameter is a number (duration) or text (reason)
      const durationOrReason = parts[1];
      const duration = parseInt(durationOrReason, 10);

      if (!isNaN(duration) && parts.length >= 3) {
        // Temporary block with duration
        const reason = parts.slice(2).join(' ');
        userBlocker.blockUserTemporary(targetUserId, reason, duration, userId, `user_${targetUserId}`);

        await ctx.reply(
          `✅ *User Blocked Temporarily*\n\n` +
          `User ID: \`${targetUserId}\`\n` +
          `Duration: ${duration} minutes\n` +
          `Reason: ${InputValidator.sanitizeMarkdown(reason)}\n\n` +
          `The user will be automatically unblocked after ${duration} minutes.`,
          { parse_mode: 'Markdown' }
        );

        logger.warn(
          `ADMIN ACTION: User ${targetUserId} temporarily blocked for ${duration} minutes by admin ${userId} (${username}): ${reason}`
        );
      } else {
        // Permanent block
        const reason = parts.slice(1).join(' ');
        userBlocker.blockUser(targetUserId, reason, userId, `user_${targetUserId}`);

        await ctx.reply(
          `✅ *User Blocked Permanently*\n\n` +
          `User ID: \`${targetUserId}\`\n` +
          `Reason: ${InputValidator.sanitizeMarkdown(reason)}\n\n` +
          `The user is now permanently blocked from using the bot.`,
          { parse_mode: 'Markdown' }
        );

        logger.warn(
          `ADMIN ACTION: User ${targetUserId} permanently blocked by admin ${userId} (${username}): ${reason}`
        );
      }

      SecurityLogger.logAdminAction('User blocked', userId, username, chatId);
    } catch (error) {
      errorMonitor.trackError('command_block', error as Error, { chatId: ctx.chat?.id, userId: ctx.from?.id });
      await ctx.reply('❌ Failed to block user. Please check logs or try again later.');
    }
  }

  /**
   * /unblock - Unblock a user (Admin only)
   * Usage: /unblock <user_id>
   */
  async unblock(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || 'unknown';

      if (!userId) return;

      // Check if user is admin
      if (!config.adminIds.includes(userId)) {
        await ctx.reply('⛔ This command is only available to administrators.');
        SecurityLogger.logUnauthorizedAccess('/unblock command', userId, username, chatId);
        return;
      }

      const messageText = (ctx.message as any)?.text || '';
      const parts = messageText.split(' ').slice(1); // Remove '/unblock'

      if (parts.length !== 1) {
        await ctx.reply(
          '❌ Invalid usage.\n\n' +
          '*Usage:* `/unblock <user_id>`\n\n' +
          '*Example:* `/unblock 123456789`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const targetUserId = parseInt(parts[0], 10);
      if (isNaN(targetUserId)) {
        await ctx.reply('❌ Invalid user ID. Please provide a numeric user ID.');
        return;
      }

      const success = userBlocker.unblockUser(targetUserId, userId);

      if (success) {
        await ctx.reply(
          `✅ *User Unblocked*\n\n` +
          `User ID: \`${targetUserId}\`\n\n` +
          `The user can now use the bot again.`,
          { parse_mode: 'Markdown' }
        );

        logger.info(
          `ADMIN ACTION: User ${targetUserId} unblocked by admin ${userId} (${username})`
        );
        SecurityLogger.logAdminAction('User unblocked', userId, username, chatId);
      } else {
        await ctx.reply(`❌ User \`${targetUserId}\` is not in the block list.`, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      errorMonitor.trackError('command_unblock', error as Error, { chatId: ctx.chat?.id, userId: ctx.from?.id });
      await ctx.reply('❌ Failed to unblock user. Please check logs or try again later.');
    }
  }

  /**
   * /blocklist - View all blocked users (Admin only)
   */
  async blocklist(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || 'unknown';

      if (!userId) return;

      // Check if user is admin
      if (!config.adminIds.includes(userId)) {
        await ctx.reply('⛔ This command is only available to administrators.');
        SecurityLogger.logUnauthorizedAccess('/blocklist command', userId, username, chatId);
        return;
      }

      const blockedUsers = userBlocker.getAllBlockedUsers();
      const stats = userBlocker.getStats();

      if (blockedUsers.length === 0) {
        await ctx.reply('✅ No users are currently blocked.');
        return;
      }

      let response = `🚫 *Blocked Users List*\n\n`;
      response += `Total: ${stats.totalBlocked} (${stats.permanentBlocks} permanent, ${stats.temporaryBlocks} temporary)\n\n`;

      blockedUsers.forEach((user, index) => {
        const blockedDate = new Date(user.blockedAt).toLocaleString('en-NG');
        const safeReason = InputValidator.sanitizeMarkdown(user.reason);
        const safeUsername = user.username ? InputValidator.sanitizeMarkdown(user.username) : 'unknown';

        response += `${index + 1}. *User ID:* \`${user.userId}\`\n`;
        response += `   Username: ${safeUsername}\n`;
        response += `   Reason: ${safeReason}\n`;
        response += `   Blocked: ${blockedDate}\n`;

        if (user.expiresAt) {
          const expiryDate = new Date(user.expiresAt);
          const now = new Date();
          const minutesLeft = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 60000));
          response += `   ⏳ Expires in: ${minutesLeft} minutes\n`;
        } else {
          response += `   Type: Permanent\n`;
        }

        response += '\n';
      });

      response += `_Use /unblock <user_id> to unblock a user_`;

      await ctx.reply(response, { parse_mode: 'Markdown' });
      logger.info(`ADMIN ACTION: Blocklist viewed by admin ${userId} (${username})`);
    } catch (error) {
      errorMonitor.trackError('command_blocklist', error as Error, { chatId: ctx.chat?.id, userId: ctx.from?.id });
      await ctx.reply('❌ Failed to retrieve block list. Please check logs or try again later.');
    }
  }
}

export default new BlockCommands();
