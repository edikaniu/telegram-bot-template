import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

const logger = new Logger('BackupService');

interface BackupConfig {
  dataDir: string;
  backupDir: string;
  maxBackups: number;
  backupIntervalHours: number;
}

interface BackupMetadata {
  timestamp: string;
  files: string[];
  size: number;
}

/**
 * Automated backup service for critical data files
 */
export class BackupService {
  private config: BackupConfig;
  private backupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<BackupConfig>) {
    this.config = {
      dataDir: path.join(process.cwd(), 'data'),
      backupDir: path.join(process.cwd(), 'backups'),
      maxBackups: 7, // Keep last 7 backups
      backupIntervalHours: 24, // Backup once per day
      ...config,
    };
  }

  /**
   * Initialize the backup service
   */
  initialize(): void {
    // Ensure backup directory exists
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
      logger.info('Backup directory created');
    }

    // Perform initial backup
    this.performBackup().catch(err => {
      logger.error('Initial backup failed:', err);
    });

    // Schedule regular backups
    this.scheduleBackups();

    logger.info(`Backup service initialized (interval: ${this.config.backupIntervalHours}h, max backups: ${this.config.maxBackups})`);
  }

  /**
   * Schedule automatic backups
   */
  private scheduleBackups(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    const intervalMs = this.config.backupIntervalHours * 60 * 60 * 1000;
    this.backupInterval = setInterval(() => {
      this.performBackup().catch(err => {
        logger.error('Scheduled backup failed:', err);
      });
    }, intervalMs);

    logger.info('Automatic backups scheduled');
  }

  /**
   * Perform a backup of all data files
   */
  async performBackup(): Promise<string> {
    try {
      logger.info('Starting backup...');

      // Create timestamp for backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${timestamp}`;
      const backupPath = path.join(this.config.backupDir, backupName);

      // Create backup directory
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }

      // Get all files to backup from data directory
      const filesToBackup = this.getDataFiles();
      const backedUpFiles: string[] = [];
      let totalSize = 0;

      // Copy each file to backup directory
      for (const file of filesToBackup) {
        const sourcePath = path.join(this.config.dataDir, file);
        const destPath = path.join(backupPath, file);

        // Ensure destination subdirectory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(sourcePath, destPath);
        backedUpFiles.push(file);

        // Track size
        const stats = fs.statSync(destPath);
        totalSize += stats.size;
      }

      // Create metadata file
      const metadata: BackupMetadata = {
        timestamp: new Date().toISOString(),
        files: backedUpFiles,
        size: totalSize,
      };

      fs.writeFileSync(
        path.join(backupPath, 'backup-metadata.json'),
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      logger.info(`Backup completed: ${backedUpFiles.length} files, ${this.formatBytes(totalSize)}`);

      // Cleanup old backups
      this.cleanupOldBackups();

      return backupPath;
    } catch (error) {
      logger.error('Backup failed:', error);
      throw error;
    }
  }

  /**
   * Get list of data files to backup
   */
  private getDataFiles(): string[] {
    const files: string[] = [];

    if (!fs.existsSync(this.config.dataDir)) {
      logger.warn('Data directory does not exist, nothing to backup');
      return files;
    }

    const scanDirectory = (dir: string, basePath: string = ''): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = path.join(basePath, entry.name);
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDirectory(fullPath, relativePath);
        } else if (entry.isFile()) {
          // Only backup specific file types
          const ext = path.extname(entry.name).toLowerCase();
          if (['.json', '.db', '.sqlite', '.txt', '.csv'].includes(ext)) {
            files.push(relativePath);
          }
        }
      }
    };

    scanDirectory(this.config.dataDir);
    return files;
  }

  /**
   * Cleanup old backups, keeping only the most recent ones
   */
  private cleanupOldBackups(): void {
    try {
      const backups = this.listBackups();

      if (backups.length > this.config.maxBackups) {
        const toDelete = backups.slice(0, backups.length - this.config.maxBackups);

        for (const backup of toDelete) {
          const backupPath = path.join(this.config.backupDir, backup.name);
          this.deleteDirectory(backupPath);
          logger.info(`Deleted old backup: ${backup.name}`);
        }

        logger.info(`Cleaned up ${toDelete.length} old backup(s)`);
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * List all backups sorted by creation time (oldest first)
   */
  listBackups(): Array<{ name: string; timestamp: Date; size: number }> {
    const backups: Array<{ name: string; timestamp: Date; size: number }> = [];

    if (!fs.existsSync(this.config.backupDir)) {
      return backups;
    }

    const entries = fs.readdirSync(this.config.backupDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('backup-')) {
        const backupPath = path.join(this.config.backupDir, entry.name);
        const metadataPath = path.join(backupPath, 'backup-metadata.json');

        let timestamp = fs.statSync(backupPath).mtime;
        let size = 0;

        // Try to read metadata for more accurate info
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata: BackupMetadata = JSON.parse(
              fs.readFileSync(metadataPath, 'utf-8')
            );
            timestamp = new Date(metadata.timestamp);
            size = metadata.size;
          } catch (error) {
            logger.warn(`Failed to read metadata for ${entry.name}`);
          }
        }

        backups.push({
          name: entry.name,
          timestamp,
          size,
        });
      }
    }

    // Sort by timestamp (oldest first)
    backups.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return backups;
  }

  /**
   * Restore from a specific backup
   */
  async restoreBackup(backupName: string): Promise<void> {
    try {
      logger.info(`Starting restore from backup: ${backupName}`);

      const backupPath = path.join(this.config.backupDir, backupName);

      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupName}`);
      }

      // Read metadata
      const metadataPath = path.join(backupPath, 'backup-metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error('Backup metadata not found');
      }

      const metadata: BackupMetadata = JSON.parse(
        fs.readFileSync(metadataPath, 'utf-8')
      );

      // Restore each file
      for (const file of metadata.files) {
        const sourcePath = path.join(backupPath, file);
        const destPath = path.join(this.config.dataDir, file);

        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(sourcePath, destPath);
      }

      logger.info(`Restore completed: ${metadata.files.length} files restored`);
    } catch (error) {
      logger.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * Delete a directory recursively
   */
  private deleteDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get backup statistics
   */
  getBackupStats(): {
    totalBackups: number;
    oldestBackup: string | null;
    newestBackup: string | null;
    totalSize: string;
  } {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      totalBackups: backups.length,
      oldestBackup: backups.length > 0 ? backups[0].timestamp.toISOString() : null,
      newestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp.toISOString() : null,
      totalSize: this.formatBytes(totalSize),
    };
  }

  /**
   * Stop the backup service
   */
  stop(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      logger.info('Backup service stopped');
    }
  }
}

// Export singleton instance
export default new BackupService();
