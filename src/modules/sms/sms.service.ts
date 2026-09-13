import axios from 'axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
    private qikberryApiUrl = 'https://rest.qikberry.ai/v1';
    private readonly quikberryTemplateId = '1707175195268473103';

    constructor() {}

    public async sendOtpMessage(phoneNumber: string, otp: string, templateId: string = this.quikberryTemplateId): Promise<void> {
        try {
            const message = `Your OTP is: ${otp}. Valid for 10 minutes.`;

            const response = await axios.post(`${this.qikberryApiUrl}/sms/messages`, {
                to: phoneNumber,
                sender: 'ZERV',
                service: 'SI',
                template_id: templateId,
                message: message,
                shorten_url: "1",
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.QIKBERRY_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log('SMS OTP API Response:', response.data);
        } catch (error: any) {
            console.error('SMS OTP sending failed:', error.response?.data || error.message);
            throw new Error('Failed to send OTP SMS');
        }
    }
}

