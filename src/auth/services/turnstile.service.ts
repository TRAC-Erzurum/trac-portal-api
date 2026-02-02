import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaptchaService } from './captcha.interface';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

@Injectable()
export class TurnstileService implements CaptchaService {
  private readonly secretKey: string | undefined;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    this.isEnabled = !!this.secretKey;
  }

  async verify(token: string | undefined, ip?: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    if (!token) {
      throw new BadRequestException('error.captchaRequired');
    }

    if (!this.secretKey) {
      throw new BadRequestException('error.captchaNotConfigured');
    }

    const formData = new URLSearchParams();
    formData.append('secret', this.secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      },
    );

    const data: TurnstileResponse = await response.json();

    if (!data.success) {
      throw new BadRequestException('error.captchaFailed');
    }
  }
}
