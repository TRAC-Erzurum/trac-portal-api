import { Injectable } from '@nestjs/common';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { R2Service, GetResult } from './r2.service';

const CACHE_MAX_ENTRIES = 30;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  body: Buffer;
  contentType?: string;
  expiresAt: number;
}

@Injectable()
export class FileStorageService {
  /** LRU in-memory cache for R2 reads (max 30 entries, 24h TTL). */
  private readonly r2Cache = new Map<string, CacheEntry>();

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
    const isCategoryImage = logicalPath.startsWith(
      'uploads/equipment-categories/',
    );
    if (isCategoryImage) {
      const local = this.localPath(logicalPath);
      try {
        const body = await readFile(local);
        const contentType = this.contentTypeFromPath(logicalPath);
        return { body, contentType };
      } catch {
        return null;
      }
    }

    const cached = this.r2Cache.get(logicalPath);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      this.r2Cache.delete(logicalPath);
      this.r2Cache.set(logicalPath, cached);
      return { body: cached.body, contentType: cached.contentType };
    }
    if (cached) this.r2Cache.delete(logicalPath);

    if (this.r2.isConfigured()) {
      const fromR2 = await this.r2.get(logicalPath);
      if (fromR2) {
        if (this.r2Cache.size >= CACHE_MAX_ENTRIES) {
          const oldestKey = this.r2Cache.keys().next().value;
          if (oldestKey !== undefined) this.r2Cache.delete(oldestKey);
        }
        this.r2Cache.set(logicalPath, {
          body: fromR2.body,
          contentType: fromR2.contentType,
          expiresAt: now + CACHE_TTL_MS,
        });
        return fromR2;
      }
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
