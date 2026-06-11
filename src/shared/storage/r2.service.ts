import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

export interface GetResult {
  body: Buffer;
  contentType?: string;
}

@Injectable()
export class R2Service {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('r2.endpoint');
    const accessKeyId = this.configService.get<string>('r2.accessKeyId');
    const secretAccessKey =
      this.configService.get<string>('r2.secretAccessKey');
    this.bucket = this.configService.get<string>('r2.bucketName') ?? '';
    this.keyPrefix =
      this.configService.get<string>('r2.keyPrefix') ??
      `trac-portal-${process.env.NODE_ENV ?? 'development'}`;

    if (endpoint && accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: true,
      });
    } else {
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private fullKey(logicalPath: string): string {
    const normalized = logicalPath.replace(/^\//, '');
    return `${this.keyPrefix}/${normalized}`;
  }

  async put(
    logicalPath: string,
    buffer: Buffer,
    contentType?: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('R2 is not configured');
    }
    const key = this.fullKey(logicalPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType ?? 'application/octet-stream',
      }),
    );
  }

  async get(logicalPath: string): Promise<GetResult | null> {
    if (!this.client) return null;
    const key = this.fullKey(logicalPath);
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!response.Body) return null;
      const body = Buffer.from(await response.Body.transformToByteArray());
      const contentType = response.ContentType ?? undefined;
      return { body, contentType };
    } catch {
      return null;
    }
  }

  async delete(logicalPath: string): Promise<void> {
    if (!this.client) return;
    const key = this.fullKey(logicalPath);
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch {
      // ignore
    }
  }
}
