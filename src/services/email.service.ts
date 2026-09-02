import { Resend } from 'resend';
import { env } from '../config/env.js';

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

const FRONTEND_URL = env.FRONTEND_URL || 'http://localhost:5173';

export interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email verification link to the user.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  displayName: string,
): Promise<EmailResult> {
  const client = getClient();
  if (!client) {
    console.warn(
      '⚠️  RESEND_API_KEY not set — skipping verification email. Token:',
      token,
    );
    return { success: true }; // Don't block registration in dev
  }

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  try {
    const { error } = await client.emails.send({
      from: env.EMAIL_FROM || 'SeeThrough <noreply@seethrough.app>',
      to,
      subject: 'Verify your email — SeeThrough',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome to SeeThrough, ${escapeHtml(displayName)}!</h1>
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            Thanks for signing up. Please verify your email address to start posting reviews.
          </p>
          <a href="${verificationUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Verify Email Address
          </a>
          <p style="font-size: 14px; color: #666; margin-top: 24px;">
            This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
          <p style="font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:<br>
            <a href="${verificationUrl}" style="color: #666; word-break: break-all;">${verificationUrl}</a>
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Failed to send verification email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to send verification email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send a password reset email to the user.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  displayName: string,
): Promise<EmailResult> {
  const client = getClient();
  if (!client) {
    console.warn(
      '⚠️  RESEND_API_KEY not set — skipping password reset email. Token:',
      token,
    );
    return { success: true };
  }

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  try {
    const { error } = await client.emails.send({
      from: env.EMAIL_FROM || 'SeeThrough <noreply@seethrough.app>',
      to,
      subject: 'Reset your password — SeeThrough',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Password Reset</h1>
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            Hi ${escapeHtml(displayName)}, we received a request to reset your password.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Reset Password
          </a>
          <p style="font-size: 14px; color: #666; margin-top: 24px;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <p style="font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:<br>
            <a href="${resetUrl}" style="color: #666; word-break: break-all;">${resetUrl}</a>
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to send password reset email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Escape HTML to prevent XSS in email templates.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
