import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly verificationCodes = new Map<
    string,
    { code: string; expiresAt: Date; email: string }
  >();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate and send verification code to email
   */
  async sendVerificationCode(email: string): Promise<string> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code with expiration (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    this.verificationCodes.set(email, {
      code,
      expiresAt,
      email,
    });

    this.logger.debug(`Verification code generated for ${email}: ${code}`);

    // Send email using SMTP configuration from environment
    try {
      await this.sendEmail(email, code, expiresAt);
      this.logger.debug(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // In case of email failure, we still keep the code in memory so you can debug
    }

    return code;
  }

  /**
   * Verify the code for an email
   */
  async verifyCode(email: string, code: string): Promise<boolean> {
    const stored = this.verificationCodes.get(email);

    if (!stored) {
      this.logger.debug(`No verification code found for ${email}`);
      return false;
    }

    if (new Date() > stored.expiresAt) {
      this.logger.debug(`Verification code expired for ${email}`);
      this.verificationCodes.delete(email);
      return false;
    }

    if (stored.code !== code) {
      this.logger.debug(`Invalid verification code for ${email}`);
      return false;
    }

    // Code is valid - remove it
    this.verificationCodes.delete(email);
    this.logger.debug(`Email verified: ${email}`);
    return true;
  }

  /**
   * Resend verification code
   */
  async resendCode(email: string): Promise<string> {
    // Remove old code if exists
    this.verificationCodes.delete(email);
    return this.sendVerificationCode(email);
  }

  /**
   * Send verification email using SMTP (nodemailer)
   * Reference: working implementation from another project
   *
   * Supported environment variables (via ConfigService / process.env):
   * - SMTP_HOST      (default: smtp.gmail.com)
   * - SMTP_PORT      (default: 587)
   * - SMTP_USER      (required)
   * - SMTP_PASSWORD  (preferred) OR SMTP_PASS (fallback)
   * - SMTP_SECURE    ('true' to use TLS/465)
   * - SMTP_FROM      (default: SMTP_USER or 'noreply@fluct.ai')
   * - APP_NAME       (for email branding, default: 'FluctBot')
   */
  private async sendEmail(
    email: string,
    code: string,
    expiresAt: Date,
  ): Promise<void> {
    const host =
      this.configService.get<string>('SMTP_HOST') ||
      process.env.SMTP_HOST ||
      'smtp.gmail.com';
    const port = parseInt(
      this.configService.get<string>('SMTP_PORT') ||
        process.env.SMTP_PORT ||
        '587',
      10,
    );
    const user =
      this.configService.get<string>('SMTP_USER') ||
      process.env.SMTP_USER ||
      '';
    const pass =
      this.configService.get<string>('SMTP_PASSWORD') ||
      this.configService.get<string>('SMTP_PASS') ||
      process.env.SMTP_PASSWORD ||
      process.env.SMTP_PASS ||
      '';

    if (!user || !pass) {
      // Fallback to logging if SMTP is not configured
      this.logger.warn(
        `SMTP_USER / SMTP_PASSWORD not configured. Verification code for ${email}: ${code}`,
      );
      return;
    }

    const secure =
      this.configService.get<string>('SMTP_SECURE') === 'true' ||
      process.env.SMTP_SECURE === 'true';

    const fromEmail =
      this.configService.get<string>('SMTP_FROM') ||
      process.env.SMTP_FROM ||
      user ||
      'noreply@fluct.ai';

    const appName =
      this.configService.get<string>('APP_NAME') ||
      process.env.APP_NAME ||
      'FluctBot';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const expiresInMinutes = Math.round(
      (expiresAt.getTime() - Date.now()) / (60 * 1000),
    );

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${appName}" <${fromEmail}>`,
      to: email,
      subject: 'Email Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="color: #2c3e50; margin-top: 0;">Email Verification</h2>
              <p>Thank you for registering with ${appName}!</p>
              <p>Please use the following code to verify your email address:</p>
              <div style="background-color: #ffffff; border: 2px dashed #3498db; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
                <h1 style="color: #3498db; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
              </div>
              <p style="color: #7f8c8d; font-size: 14px;">This code will expire in 10 minutes.</p>
              <p style="color: #7f8c8d; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            </div>
            <p style="color: #95a5a6; font-size: 12px; text-align: center; margin-top: 30px;">
              © ${new Date().getFullYear()} ${appName}. All rights reserved.
            </p>
          </body>
        </html>
      `,
      text: `
Email Verification

Thank you for registering with ${appName}!

Please use the following code to verify your email address:

${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

© ${new Date().getFullYear()} ${appName}. All rights reserved.
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    this.logger.debug(
      `Verification email sent to ${email}, messageId=${info.messageId}`,
    );
  }

  /**
   * Send welcome email after onboarding completion
   */
  async sendWelcomeEmail(
    email: string,
    userName?: string,
  ): Promise<void> {
    const host =
      this.configService.get<string>('SMTP_HOST') ||
      process.env.SMTP_HOST ||
      'smtp.gmail.com';
    const port = parseInt(
      this.configService.get<string>('SMTP_PORT') ||
        process.env.SMTP_PORT ||
        '587',
      10,
    );
    const user =
      this.configService.get<string>('SMTP_USER') ||
      process.env.SMTP_USER ||
      '';
    const pass =
      this.configService.get<string>('SMTP_PASSWORD') ||
      this.configService.get<string>('SMTP_PASS') ||
      process.env.SMTP_PASSWORD ||
      process.env.SMTP_PASS ||
      '';

    if (!user || !pass) {
      // Fallback to logging if SMTP is not configured
      this.logger.warn(
        `SMTP_USER / SMTP_PASSWORD not configured. Welcome email not sent to ${email}`,
      );
      return;
    }

    const secure =
      this.configService.get<string>('SMTP_SECURE') === 'true' ||
      process.env.SMTP_SECURE === 'true';

    const fromEmail =
      this.configService.get<string>('SMTP_FROM') ||
      process.env.SMTP_FROM ||
      user ||
      'noreply@fluct.ai';

    const appName =
      this.configService.get<string>('APP_NAME') ||
      process.env.APP_NAME ||
      'FluctBot';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const displayName = userName || 'User';

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${appName}" <${fromEmail}>`,
      to: email,
      subject: `Welcome to ${appName}! 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px;">🎉 Welcome to ${appName}!</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 18px; color: #2c3e50; margin-top: 0;">Hello ${displayName},</p>
              <p>Thank you for completing the onboarding process! Your account has been successfully created and verified.</p>
              <p>You can now enjoy all the features ${appName} has to offer:</p>
              <ul style="color: #555; line-height: 2;">
                <li>✅ Secure and verified account</li>
                <li>✅ Access to all platform features</li>
                <li>✅ Multi-platform support (Telegram, Web Chat, and more)</li>
              </ul>
              <p style="margin-top: 30px;">If you have any questions or need assistance, feel free to reach out to our support team.</p>
              <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px;">We're excited to have you on board!</p>
            </div>
            <p style="color: #95a5a6; font-size: 12px; text-align: center; margin-top: 30px;">
              © ${new Date().getFullYear()} ${appName}. All rights reserved.
            </p>
          </body>
        </html>
      `,
      text: `
Welcome to ${appName}! 🎉

Hello ${displayName},

Thank you for completing the onboarding process! Your account has been successfully created and verified.

You can now enjoy all the features ${appName} has to offer:
✅ Secure and verified account
✅ Access to all platform features
✅ Multi-platform support (Telegram, Web Chat, and more)

If you have any questions or need assistance, feel free to reach out to our support team.

We're excited to have you on board!

© ${new Date().getFullYear()} ${appName}. All rights reserved.
      `.trim(),
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      this.logger.debug(
        `Welcome email sent to ${email}, messageId=${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Don't throw - email failure shouldn't break onboarding completion
    }
  }
}

