import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { ObjectStorageService } from './objectStorage';

export enum FileAssetType {
  LOCAL = 'LOCAL',
  OBJECT_STORAGE = 'OBJECT_STORAGE',
  REMOTE_URL = 'REMOTE_URL',
  UNKNOWN = 'UNKNOWN'
}

export interface FileAssetInfo {
  type: FileAssetType;
  originalUrl: string;
  normalizedUrl: string;
  exists: boolean;
}

export class FileAssetResolver {
  private objectStorage: ObjectStorageService;
  private privateObjectDir: string | null;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.privateObjectDir = process.env.PRIVATE_OBJECT_DIR || null;
  }

  private normalizePathSlashes(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return path.replace(/\/+/g, '/');
  }

  normalizeUrl(fileUrl: string): { url: string; type: FileAssetType } {
    if (!fileUrl) return { url: fileUrl, type: FileAssetType.UNKNOWN };
    
    if (fileUrl.startsWith('/files/')) {
      return { url: this.normalizePathSlashes(fileUrl), type: FileAssetType.LOCAL };
    }
    
    if (fileUrl.startsWith('/objects/')) {
      return { url: this.normalizePathSlashes(fileUrl), type: FileAssetType.OBJECT_STORAGE };
    }
    
    if (fileUrl.startsWith('https://storage.googleapis.com/') && this.privateObjectDir) {
      try {
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          const gcsObjectPath = pathParts.slice(1).join('/');
          
          const privateDir = this.privateObjectDir.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/');
          const privateDirParts = privateDir.split('/').filter(Boolean);
          
          let expectedPrefix: string;
          if (privateDirParts[0]?.startsWith('replit-objstore-')) {
            expectedPrefix = privateDirParts.slice(1).join('/');
          } else {
            expectedPrefix = privateDirParts.join('/');
          }
          
          if (gcsObjectPath.startsWith(expectedPrefix)) {
            let relativePath = gcsObjectPath.slice(expectedPrefix.length);
            if (relativePath.startsWith('/')) {
              relativePath = relativePath.slice(1);
            }
            const normalizedPath = `/objects/${relativePath}`.replace(/\/+/g, '/');
            console.log(`🔄 Normalized legacy GCS URL to ${normalizedPath}`);
            return { url: normalizedPath, type: FileAssetType.OBJECT_STORAGE };
          }
        }
      } catch (e) {
        console.error('Failed to parse GCS URL:', e);
      }
      return { url: fileUrl, type: FileAssetType.REMOTE_URL };
    }
    
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return { url: fileUrl, type: FileAssetType.REMOTE_URL };
    }
    
    return { url: fileUrl, type: FileAssetType.UNKNOWN };
  }

  classifyUrl(fileUrl: string): FileAssetType {
    return this.normalizeUrl(fileUrl).type;
  }

  async getAssetInfo(fileUrl: string): Promise<FileAssetInfo> {
    const { url: normalizedUrl, type } = this.normalizeUrl(fileUrl);
    let exists = false;

    try {
      switch (type) {
        case FileAssetType.LOCAL:
          const localPath = this.resolveLocalPath(normalizedUrl);
          exists = fs.existsSync(localPath);
          break;
          
        case FileAssetType.OBJECT_STORAGE:
          exists = await this.objectStorage.objectExists(normalizedUrl);
          break;
          
        case FileAssetType.REMOTE_URL:
          try {
            const response = await fetch(normalizedUrl, { method: 'HEAD' });
            exists = response.ok;
          } catch {
            exists = false;
          }
          break;
      }
    } catch (error) {
      console.error(`Error checking asset existence: ${error}`);
      exists = false;
    }

    return {
      type,
      originalUrl: fileUrl,
      normalizedUrl,
      exists
    };
  }

  private resolveLocalPath(fileUrl: string): string {
    const filesDir = process.env.FILES_DIR || "./files";
    const localFileName = path.basename(fileUrl);
    const sanitizedFileName = localFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(filesDir, sanitizedFileName);
  }

  async downloadToTempFile(fileUrl: string): Promise<{ tempPath: string; cleanup: () => void }> {
    const { url: normalizedUrl, type } = this.normalizeUrl(fileUrl);
    const tempDir = os.tmpdir();
    const tempFileName = `credit-report-${randomUUID()}.pdf`;
    const tempPath = path.join(tempDir, tempFileName);

    const cleanup = () => {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
          console.log(`🧹 Cleaned up temp file: ${tempPath}`);
        }
      } catch (error) {
        console.error(`Error cleaning up temp file: ${error}`);
      }
    };

    try {
      switch (type) {
        case FileAssetType.LOCAL:
          const localPath = this.resolveLocalPath(normalizedUrl);
          if (!fs.existsSync(localPath)) {
            throw new Error(`Local file not found: ${localPath}`);
          }
          fs.copyFileSync(localPath, tempPath);
          console.log(`📁 Copied local file to temp: ${tempPath}`);
          break;

        case FileAssetType.OBJECT_STORAGE:
          const buffer = await this.objectStorage.downloadToBuffer(normalizedUrl);
          fs.writeFileSync(tempPath, buffer);
          console.log(`☁️ Downloaded Object Storage file to temp: ${tempPath}`);
          break;

        case FileAssetType.REMOTE_URL:
          console.log(`🌐 Downloading from remote URL: ${normalizedUrl}`);
          const response = await fetch(normalizedUrl, {
            headers: { 'User-Agent': 'PersonalCreditPros/1.0' }
          });
          if (!response.ok) {
            throw new Error(`Failed to download: ${response.statusText}`);
          }
          const remoteBuffer = Buffer.from(await response.arrayBuffer());
          fs.writeFileSync(tempPath, remoteBuffer);
          console.log(`🌐 Downloaded remote file to temp: ${tempPath}`);
          break;

        default:
          throw new Error(`Unknown file URL type: ${fileUrl}`);
      }

      if (!fs.existsSync(tempPath)) {
        throw new Error(`Failed to create temp file: ${tempPath}`);
      }

      const stats = fs.statSync(tempPath);
      if (stats.size === 0) {
        cleanup();
        throw new Error('Downloaded file is empty');
      }

      console.log(`✅ Temp file ready: ${tempPath} (${stats.size} bytes)`);
      return { tempPath, cleanup };

    } catch (error) {
      cleanup();
      throw error;
    }
  }

  async deleteAsset(fileUrl: string): Promise<boolean> {
    const { url: normalizedUrl, type } = this.normalizeUrl(fileUrl);

    try {
      switch (type) {
        case FileAssetType.LOCAL:
          const localPath = this.resolveLocalPath(normalizedUrl);
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            console.log(`🗑️ Deleted local file: ${localPath}`);
            return true;
          }
          return false;

        case FileAssetType.OBJECT_STORAGE:
          await this.objectStorage.deleteObject(normalizedUrl);
          console.log(`🗑️ Deleted Object Storage file: ${normalizedUrl}`);
          return true;

        case FileAssetType.REMOTE_URL:
          console.log(`⚠️ Cannot delete remote URL: ${normalizedUrl}`);
          return false;

        default:
          console.warn(`Unknown file type, cannot delete: ${fileUrl}`);
          return false;
      }
    } catch (error) {
      console.error(`Error deleting asset: ${error}`);
      return false;
    }
  }
}

export const fileAssetResolver = new FileAssetResolver();
