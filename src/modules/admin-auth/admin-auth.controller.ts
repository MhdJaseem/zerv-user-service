import { Controller, Post, Body, UnauthorizedException, Req, Headers, BadRequestException, ForbiddenException } from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service";
import { Request } from "express";

@Controller('admin-auth')
export class AdminAuthController {
  constructor(private authService: AdminAuthService) { }

  @Post('login')
  async login(@Body() loginDto: { email: string; password: string; role?: string; }, @Req() req: Request) {
    try {
      const rawClientId = req['clientId'];
      const clientId = typeof rawClientId === 'string' ? rawClientId : '';
      const origin = req.headers?.['origin'];

      const user = await this.authService.validateUser(
        loginDto.email,
        loginDto.password,
        clientId
      );

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (origin === 'https://console.dev.zervfoods.com' && user.role !== 'super-admin') {
        throw new UnauthorizedException('Only Super Admin can access this dashboard');
      }

      const isLead = (user as any)?.leadId ? true : false;
      if (!clientId && user.role !== 'super-admin' && !isLead) {
        throw new UnauthorizedException('Admin must login with a restaurantId!');
      }

      if (loginDto?.role && user?.role !== loginDto?.role) {
        throw new UnauthorizedException('Login user role not found!');
      }

      return await this.authService.generateTokens(user);
    } catch (error) {
      console.error('Error logging in admin:', error);
      if (
        error instanceof UnauthorizedException || 
        error instanceof ForbiddenException ||
        (error?.getStatus && [401, 403].includes(error.getStatus()))
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token: string }) {
    return this.authService.refreshAccessToken(body.refresh_token);
  }

  @Post('logout')
  async logout(
    @Headers() headers: Headers
  ) {
    if (!headers?.['accesstoken']) {
      throw new UnauthorizedException('Access token is required for logout');
    }
    await this.authService.logout(headers?.['accesstoken']);
    return { message: 'Logged out successfully' };
  }
}