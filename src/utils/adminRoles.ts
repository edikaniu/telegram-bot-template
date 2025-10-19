import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import config from '../config';

const logger = new Logger('AdminRoles');

/**
 * Admin permission levels
 */
export enum AdminRole {
  SUPER_ADMIN = 'super_admin',    // Full access, can manage other admins
  ADMIN = 'admin',                 // Most commands, cannot manage admins
  MODERATOR = 'moderator',         // Limited access (blocking, viewing stats)
  VIEWER = 'viewer',               // Read-only access (stats, health)
}

/**
 * Permission definitions for each role
 */
export interface RolePermissions {
  canManageAdmins: boolean;        // Add/remove admins
  canManageUsers: boolean;         // Block/unblock users
  canTriggerBackup: boolean;       // Manual backups
  canRefreshData: boolean;         // Refresh fund data
  canViewStats: boolean;           // View analytics
  canViewHealth: boolean;          // View health checks
  canViewBlocklist: boolean;       // View blocked users
}

interface AdminUser {
  userId: number;
  username?: string;
  role: AdminRole;
  addedBy?: number;
  addedAt: string;
}

interface AdminConfig {
  admins: AdminUser[];
  lastModified: string;
}

/**
 * Role-based permission system for admins
 */
export class AdminRoleManager {
  private configFile: string;
  private admins: Map<number, AdminUser> = new Map();

  // Define permissions for each role
  private readonly rolePermissions: Record<AdminRole, RolePermissions> = {
    [AdminRole.SUPER_ADMIN]: {
      canManageAdmins: true,
      canManageUsers: true,
      canTriggerBackup: true,
      canRefreshData: true,
      canViewStats: true,
      canViewHealth: true,
      canViewBlocklist: true,
    },
    [AdminRole.ADMIN]: {
      canManageAdmins: false,
      canManageUsers: true,
      canTriggerBackup: true,
      canRefreshData: true,
      canViewStats: true,
      canViewHealth: true,
      canViewBlocklist: true,
    },
    [AdminRole.MODERATOR]: {
      canManageAdmins: false,
      canManageUsers: true,
      canTriggerBackup: false,
      canRefreshData: false,
      canViewStats: true,
      canViewHealth: false,
      canViewBlocklist: true,
    },
    [AdminRole.VIEWER]: {
      canManageAdmins: false,
      canManageUsers: false,
      canTriggerBackup: false,
      canRefreshData: false,
      canViewStats: true,
      canViewHealth: true,
      canViewBlocklist: false,
    },
  };

  constructor() {
    this.configFile = path.join(process.cwd(), 'data', 'admin-roles.json');
    this.loadAdmins();
  }

  /**
   * Load admin configuration from file
   */
  private loadAdmins(): void {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf-8');
        const adminConfig: AdminConfig = JSON.parse(data);

        this.admins.clear();
        for (const admin of adminConfig.admins) {
          this.admins.set(admin.userId, admin);
        }

        logger.info(`Loaded ${this.admins.size} admin(s) with roles`);
      } else {
        // Initialize with super admins from config
        this.initializeFromConfig();
      }
    } catch (error) {
      logger.error('Failed to load admin roles:', error);
      this.initializeFromConfig();
    }
  }

  /**
   * Initialize admin roles from main config
   */
  private initializeFromConfig(): void {
    // Set all admins from config as super admins
    for (const userId of config.adminIds) {
      this.admins.set(userId, {
        userId,
        role: AdminRole.SUPER_ADMIN,
        addedAt: new Date().toISOString(),
      });
    }

    this.saveAdmins();
    logger.info(`Initialized ${this.admins.size} super admin(s) from config`);
  }

  /**
   * Save admin configuration to file
   */
  private saveAdmins(): void {
    try {
      const dir = path.dirname(this.configFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const adminConfig: AdminConfig = {
        admins: Array.from(this.admins.values()),
        lastModified: new Date().toISOString(),
      };

      fs.writeFileSync(this.configFile, JSON.stringify(adminConfig, null, 2), 'utf-8');
      logger.info('Admin roles saved');
    } catch (error) {
      logger.error('Failed to save admin roles:', error);
    }
  }

  /**
   * Check if user is an admin (any role)
   */
  isAdmin(userId: number): boolean {
    return this.admins.has(userId);
  }

  /**
   * Get user's admin role
   */
  getRole(userId: number): AdminRole | null {
    const admin = this.admins.get(userId);
    return admin ? admin.role : null;
  }

  /**
   * Get permissions for a user
   */
  getPermissions(userId: number): RolePermissions | null {
    const role = this.getRole(userId);
    return role ? this.rolePermissions[role] : null;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(userId: number, permission: keyof RolePermissions): boolean {
    const permissions = this.getPermissions(userId);
    return permissions ? permissions[permission] : false;
  }

  /**
   * Add or update admin
   */
  setAdmin(userId: number, role: AdminRole, addedBy?: number, username?: string): boolean {
    // Only super admins can add/modify admins
    if (addedBy && !this.hasPermission(addedBy, 'canManageAdmins')) {
      logger.warn(`User ${addedBy} attempted to add admin without permission`);
      return false;
    }

    const existingAdmin = this.admins.get(userId);

    this.admins.set(userId, {
      userId,
      username,
      role,
      addedBy,
      addedAt: existingAdmin?.addedAt || new Date().toISOString(),
    });

    this.saveAdmins();

    logger.info(`${existingAdmin ? 'Updated' : 'Added'} admin ${userId} (${username || 'unknown'}) with role ${role}`);
    return true;
  }

  /**
   * Remove admin
   */
  removeAdmin(userId: number, removedBy: number): boolean {
    // Only super admins can remove admins
    if (!this.hasPermission(removedBy, 'canManageAdmins')) {
      logger.warn(`User ${removedBy} attempted to remove admin without permission`);
      return false;
    }

    // Cannot remove yourself
    if (userId === removedBy) {
      logger.warn(`User ${removedBy} attempted to remove themselves`);
      return false;
    }

    // Cannot remove super admins from original config
    if (config.adminIds.includes(userId)) {
      logger.warn(`Attempted to remove super admin ${userId} from config`);
      return false;
    }

    if (this.admins.delete(userId)) {
      this.saveAdmins();
      logger.info(`Removed admin ${userId}`);
      return true;
    }

    return false;
  }

  /**
   * Get all admins
   */
  getAllAdmins(): AdminUser[] {
    return Array.from(this.admins.values());
  }

  /**
   * Get admins by role
   */
  getAdminsByRole(role: AdminRole): AdminUser[] {
    return Array.from(this.admins.values()).filter(admin => admin.role === role);
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(role: AdminRole): string {
    const names: Record<AdminRole, string> = {
      [AdminRole.SUPER_ADMIN]: '🔴 Super Admin',
      [AdminRole.ADMIN]: '🟠 Admin',
      [AdminRole.MODERATOR]: '🟡 Moderator',
      [AdminRole.VIEWER]: '🟢 Viewer',
    };
    return names[role];
  }

  /**
   * Generate admin list report
   */
  generateAdminListReport(): string {
    const admins = this.getAllAdmins();

    if (admins.length === 0) {
      return '👥 *Admin List*\n\nNo admins configured.';
    }

    // Group by role
    const byRole: Record<string, AdminUser[]> = {};
    for (const admin of admins) {
      if (!byRole[admin.role]) {
        byRole[admin.role] = [];
      }
      byRole[admin.role].push(admin);
    }

    let report = `👥 *Admin List* (${admins.length} total)\n\n`;

    // Show in role order
    const roleOrder = [
      AdminRole.SUPER_ADMIN,
      AdminRole.ADMIN,
      AdminRole.MODERATOR,
      AdminRole.VIEWER,
    ];

    for (const role of roleOrder) {
      if (byRole[role] && byRole[role].length > 0) {
        report += `${this.getRoleDisplayName(role)} (${byRole[role].length})\n`;
        for (const admin of byRole[role]) {
          const username = admin.username ? `@${admin.username}` : `ID: ${admin.userId}`;
          report += `  • ${username}\n`;
        }
        report += '\n';
      }
    }

    return report;
  }

  /**
   * Generate permissions report for a user
   */
  generatePermissionsReport(userId: number): string {
    const role = this.getRole(userId);
    const permissions = this.getPermissions(userId);

    if (!role || !permissions) {
      return '❌ Not an admin';
    }

    let report = `🔐 *Your Permissions*\n\n`;
    report += `Role: ${this.getRoleDisplayName(role)}\n\n`;
    report += `*Access Level:*\n`;
    report += `${permissions.canManageAdmins ? '✅' : '❌'} Manage Admins\n`;
    report += `${permissions.canManageUsers ? '✅' : '❌'} Manage Users (Block/Unblock)\n`;
    report += `${permissions.canTriggerBackup ? '✅' : '❌'} Trigger Backups\n`;
    report += `${permissions.canRefreshData ? '✅' : '❌'} Refresh Data\n`;
    report += `${permissions.canViewStats ? '✅' : '❌'} View Statistics\n`;
    report += `${permissions.canViewHealth ? '✅' : '❌'} View Health Status\n`;
    report += `${permissions.canViewBlocklist ? '✅' : '❌'} View Blocklist\n`;

    return report;
  }
}

// Export singleton instance
export default new AdminRoleManager();
