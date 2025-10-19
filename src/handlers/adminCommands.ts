import { Context } from 'telegraf';
import adminRoles, { AdminRole } from '../utils/adminRoles';
import SecurityLogger from '../utils/securityLogger';
import errorMonitor from '../utils/errorMonitor';
import { Logger } from '../utils/logger';

const logger = new Logger('AdminCommands');

export class AdminCommands {
  /**
   * /admins - List all admins
   */
  async listAdmins(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;

      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Only admins can view admin list
      if (!adminRoles.isAdmin(userId)) {
        await ctx.reply('⛔ This command is only available to administrators.');
        return;
      }

      const report = adminRoles.generateAdminListReport();
      await ctx.reply(report, { parse_mode: 'Markdown' });

      logger.info(`Admin list viewed by ${userId} (${username || 'unknown'})`);
    } catch (error) {
      const errorContext = { userId: ctx.from?.id, username: ctx.from?.username };
      errorMonitor.trackError('command_admins', error as Error, errorContext);
      await ctx.reply('❌ Failed to retrieve admin list.');
    }
  }

  /**
   * /mypermissions - View your own permissions
   */
  async myPermissions(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;

      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      const report = adminRoles.generatePermissionsReport(userId);
      await ctx.reply(report, { parse_mode: 'Markdown' });

      logger.info(`Permissions viewed by ${userId} (${username || 'unknown'})`);
    } catch (error) {
      const errorContext = { userId: ctx.from?.id, username: ctx.from?.username };
      errorMonitor.trackError('command_mypermissions', error as Error, errorContext);
      await ctx.reply('❌ Failed to retrieve permissions.');
    }
  }

  /**
   * /addadmin - Add a new admin
   * Usage: /addadmin <user_id> <role> [username]
   * Roles: super_admin, admin, moderator, viewer
   */
  async addAdmin(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;

      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Check permission
      if (!adminRoles.hasPermission(userId, 'canManageAdmins')) {
        SecurityLogger.logEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'high',
          description: `User ${userId} (${username || 'unknown'}) attempted to add admin without permission`,
          userId: userId,
          metadata: { command: 'addadmin' },
        });
        await ctx.reply('⛔ You do not have permission to manage admins.');
        return;
      }

      // Parse command
      const text = (ctx.message && 'text' in ctx.message) ? ctx.message.text : '';
      const parts = text.split(/\s+/).slice(1); // Remove /addadmin

      if (parts.length < 2) {
        await ctx.reply(
          '❌ Usage: `/addadmin <user_id> <role> [username]`\n\n' +
          'Roles: `super_admin`, `admin`, `moderator`, `viewer`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const targetUserId = parseInt(parts[0], 10);
      const roleStr = parts[1].toLowerCase();
      const targetUsername = parts[2];

      if (isNaN(targetUserId)) {
        await ctx.reply('❌ Invalid user ID. Please provide a numeric user ID.');
        return;
      }

      // Validate role
      const validRoles: string[] = Object.values(AdminRole);
      if (!validRoles.includes(roleStr)) {
        await ctx.reply(
          `❌ Invalid role. Valid roles:\n${validRoles.map(r => `• \`${r}\``).join('\n')}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const role = roleStr as AdminRole;

      // Add admin
      const success = adminRoles.setAdmin(targetUserId, role, userId, targetUsername);

      if (success) {
        await ctx.reply(
          `✅ Successfully added admin!\n\n` +
          `User: ${targetUsername ? `@${targetUsername}` : targetUserId}\n` +
          `Role: ${adminRoles.getRoleDisplayName(role)}`,
          { parse_mode: 'Markdown' }
        );

        SecurityLogger.logAdminAction(
          `Added admin ${targetUserId} with role ${role}`,
          userId,
          username,
          ctx.chat?.id
        );

        logger.info(`Admin ${targetUserId} added with role ${role} by ${userId} (${username || 'unknown'})`);
      } else {
        await ctx.reply('❌ Failed to add admin. Check logs for details.');
      }
    } catch (error) {
      const errorContext = { userId: ctx.from?.id, username: ctx.from?.username };
      errorMonitor.trackError('command_addadmin', error as Error, errorContext);
      await ctx.reply('❌ Failed to add admin.');
    }
  }

  /**
   * /removeadmin - Remove an admin
   * Usage: /removeadmin <user_id>
   */
  async removeAdmin(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;

      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Check permission
      if (!adminRoles.hasPermission(userId, 'canManageAdmins')) {
        SecurityLogger.logEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'high',
          description: `User ${userId} (${username || 'unknown'}) attempted to remove admin without permission`,
          userId: userId,
          metadata: { command: 'removeadmin' },
        });
        await ctx.reply('⛔ You do not have permission to manage admins.');
        return;
      }

      // Parse command
      const text = (ctx.message && 'text' in ctx.message) ? ctx.message.text : '';
      const parts = text.split(/\s+/).slice(1);

      if (parts.length < 1) {
        await ctx.reply('❌ Usage: `/removeadmin <user_id>`', { parse_mode: 'Markdown' });
        return;
      }

      const targetUserId = parseInt(parts[0], 10);

      if (isNaN(targetUserId)) {
        await ctx.reply('❌ Invalid user ID. Please provide a numeric user ID.');
        return;
      }

      // Remove admin
      const success = adminRoles.removeAdmin(targetUserId, userId);

      if (success) {
        await ctx.reply(`✅ Successfully removed admin ${targetUserId}`);

        SecurityLogger.logAdminAction(
          `Removed admin ${targetUserId}`,
          userId,
          username,
          ctx.chat?.id
        );

        logger.info(`Admin ${targetUserId} removed by ${userId} (${username || 'unknown'})`);
      } else {
        await ctx.reply('❌ Failed to remove admin. You may not have permission, or the user is a protected super admin.');
      }
    } catch (error) {
      const errorContext = { userId: ctx.from?.id, username: ctx.from?.username };
      errorMonitor.trackError('command_removeadmin', error as Error, errorContext);
      await ctx.reply('❌ Failed to remove admin.');
    }
  }
}

export default new AdminCommands();
