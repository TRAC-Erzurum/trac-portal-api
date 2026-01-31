export interface CaptchaService {
  verify(token: string | undefined, ip?: string): Promise<void>;
}

export const CAPTCHA_SERVICE = 'CAPTCHA_SERVICE';
