import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { EmailService } from './email.service';
import { SendOrderEmailDto } from './dto/email.dto';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send-order')
  @HttpCode(HttpStatus.OK)
  async sendOrderMail(
    @Body() sendOrderEmailDto: SendOrderEmailDto,
  ) {
    await this.emailService.sendOrderEmail(sendOrderEmailDto);
    return { message: 'Order email sent successfully' };
  }
}