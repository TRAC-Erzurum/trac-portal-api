import { Injectable } from '@nestjs/common';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { R2Service, GetResult } from './r2.service';

@Injectable()
export class FileStorageService {
  constructor(private readonly r2: R2Service) {}

  private localPath(logicalPath: string): string {
    const normalized = logicalPath.replace(/^\//, '');
    return join(process.cwd(), normalized);
  }

  async getBytes(logicalPath: string): Promise<Buffer> {
    const result = await this.getWithContentType(logicalPath);
    if (!result) throw new Error(`File not found: ${logicalPath}`);
    return result.body;
  }

  async getWithContentType(logicalPath: string): Promise<GetResult | null> {
    if (this.r2.isConfigured()) {
      const fromR2 = await this.r2.get(logicalPath);
      if (fromR2) return fromR2;
    }
    const local = this.localPath(logicalPath);
    try {
      const body = await readFile(local);
      const contentType = this.contentTypeFromPath(logicalPath);
      return { body, contentType };
    } catch {
      return null;
    }
  }

  private contentTypeFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    return map[ext ?? ''] ?? 'application/octet-stream';
  }

  async putBytes(
    logicalPath: string,
    buffer: Buffer,
    contentType?: string,
  ): Promise<void> {
    if (!this.r2.isConfigured()) {
      throw new Error('R2 is not configured; cannot upload');
    }
    const type = contentType ?? this.contentTypeFromPath(logicalPath);
    await this.r2.put(logicalPath, buffer, type);
  }

  async delete(logicalPath: string): Promise<void> {
    if (this.r2.isConfigured()) {
      await this.r2.delete(logicalPath);
    }
    const local = this.localPath(logicalPath);
    try {
      await unlink(local);
    } catch {
      // file may not exist locally
    }
  }
}
