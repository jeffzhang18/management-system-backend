import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  private getTransporter(): Transporter {
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    if (!user || !pass) {
      throw new ServiceUnavailableException('Mail service is not configured');
    }
    if (!this.transporter) {
      const port = Number(process.env.MAIL_PORT || 465);
      this.transporter = createTransport({
        host: process.env.MAIL_HOST || 'smtp.126.com',
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    }
    return this.transporter;
  }

  async sendVerificationCode(to: string, code: string, ttlMinutes: number) {
    const transporter = this.getTransporter();
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to,
        subject: '注册验证码',
        text: `您的注册验证码是 ${code}，${ttlMinutes} 分钟内有效。如非本人操作，请忽略此邮件。`,
        html: `<p>您的注册验证码是 <b style="font-size:20px;letter-spacing:4px">${code}</b></p><p>${ttlMinutes} 分钟内有效。如非本人操作，请忽略此邮件。</p>`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification mail: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Failed to send verification email',
      );
    }
  }
}
