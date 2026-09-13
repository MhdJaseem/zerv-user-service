import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { HttpClientService } from '../../common/inter-service-communication/http-client.service';
import { SendOrderEmailDto } from './dto/email.dto';
import { MicrosoftConfig } from '../../common/interfaces/microsoft.config';

interface GraphEmailRecipient {
  emailAddress: {
    address: string;
  };
}

interface GraphEmailMessage {
  subject: string;
  body: {
    contentType: 'HTML' | 'Text';
    content: string;
  };
  toRecipients: GraphEmailRecipient[];
  ccRecipients?: GraphEmailRecipient[];
  replyTo?: GraphEmailRecipient[];
}

@Injectable()
export class EmailService {
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClientService: HttpClientService,
  ) { }

  private get microsoft(): MicrosoftConfig {
    const config = this.configService.get<MicrosoftConfig>('email.microsoft') as MicrosoftConfig;
    if (!config?.clientId || !config?.clientSecret || !config?.tenantId || !config?.senderEmail) {
      throw new Error('Microsoft email configuration is missing');
    }
    return config;
  }

  private get authority() {
    return `https://login.microsoftonline.com/${this.microsoft.tenantId}`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken!;
    }
    console.log('[EmailService] Fetching new Microsoft Graph access token...');
    try {
      const response = await fetch(`${this.authority}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.microsoft.clientId,
          client_secret: this.microsoft.clientSecret,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EmailService] Token fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Failed to get email access token: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60_000;

      console.log('[EmailService] Microsoft Graph access token acquired successfully.');
      return this.accessToken!;
    } catch (err) {
      console.error('[EmailService] Error fetching access token:', err.message);
      throw new InternalServerErrorException('Failed to get email access token');
    }
  }

  private sanitize(input: string): string {
    if (!input) return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async sendGraphMail(message: GraphEmailMessage): Promise<void> {
    console.log(`[EmailService] Attempting to send Graph mail to: ${message.toRecipients[0].emailAddress.address}`);
    try {
      fs.appendFileSync('email-service-debug.log', `${new Date().toISOString()} - Sending Graph mail to ${message.toRecipients[0].emailAddress.address}\n`);
    } catch (e) {}

    const token = await this.getAccessToken();

    try {
      const response = await fetch(
        `${this.microsoft.graphBase}/users/${this.microsoft.senderEmail}/sendMail`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            saveToSentItems: true,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[EmailService] Graph API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        try {
          fs.appendFileSync('email-service-debug.log', `${new Date().toISOString()} - Graph API Error: ${response.status} ${JSON.stringify(errorData)}\n`);
        } catch (e) {}
        throw new Error(`Graph API returned an error: ${response.status} ${response.statusText}`);
      }
      console.log(`[EmailService] Graph mail sent successfully to ${message.toRecipients[0].emailAddress.address}`);
      try {
        fs.appendFileSync('email-service-debug.log', `${new Date().toISOString()} - Success sending to ${message.toRecipients[0].emailAddress.address}\n`);
      } catch (e) {}
    } catch (error) {
      console.error('[EmailService] Failed to send email via Graph API:', error.message);
      try {
        fs.appendFileSync('email-service-debug.log', `${new Date().toISOString()} - Failed to send: ${error.message}\n`);
      } catch (e) {}
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async sendEmail(
    toEmail: string,
    subject: string,
    htmlContent: string,
  ): Promise<void> {
    console.log(`[EmailService] Preparing to send email to ${toEmail} with subject: ${subject}`);
    const message: GraphEmailMessage = {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlContent,
      },
      toRecipients: [{ emailAddress: { address: toEmail } }],
    };

    await this.sendGraphMail(message);
  }

  async sendToBranch(
    subject: string,
    htmlContent: string,
    branchId: string,
    replyTo?: string,
  ): Promise<void> {
    const branch = await this.httpClientService.get(
      'MENU_SERVICE',
      `/branch/${branchId}`,
    ) as any;

    if (!branch?.email) {
      throw new Error('Branch email not found');
    }

    const message: GraphEmailMessage = {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlContent,
      },
      toRecipients: [{ emailAddress: { address: branch.email } }],
    };

    if (replyTo) {
      message.replyTo = [{ emailAddress: { address: replyTo } }];
    }

    await this.sendGraphMail(message);
  }

  async sendOrderEmail(dto: SendOrderEmailDto): Promise<void> {
    const name = this.sanitize(dto.name);
    const email = this.sanitize(dto.email);
    const phone = this.sanitize(dto.phone);
    const guests = this.sanitize(String(dto.guests));
    const orderItems = this.sanitize(dto.orderItems);
    const eventDate = this.sanitize(dto.eventDate);
    const deliveryType = this.sanitize(dto.deliveryType);
    const address = this.sanitize(dto.address || '');
    const notes = this.sanitize(dto.notes || '');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #222;">
        <h2>New Catering Request</h2>
        <table>
          <tr><td><b>Name:</b></td><td>${name}</td></tr>
          <tr><td><b>Email:</b></td><td>${email}</td></tr>
          <tr><td><b>Phone:</b></td><td>${phone}</td></tr>
          <tr><td><b>Guests:</b></td><td>${guests}</td></tr>
          <tr><td><b>Order Items:</b></td><td><pre>${orderItems}</pre></td></tr>
          <tr><td><b>Event Date:</b></td><td>${eventDate}</td></tr>
          <tr><td><b>Delivery Type:</b></td><td>${deliveryType}</td></tr>
          ${deliveryType === 'delivery'
        ? `<tr><td><b>Address:</b></td><td>${address}</td></tr>`
        : ''
      }
          <tr><td><b>Notes:</b></td><td>${notes}</td></tr>
        </table>
      </div>
    `;

    await this.sendToBranch(
      'New Catering Request',
      htmlContent,
      dto.branchId,
      dto.email,
    );
  }
}
