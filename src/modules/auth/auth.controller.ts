import { Request } from 'express';
import { Controller, Post, Body, Get, Query, Req, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

import { VerifyOtpDto, RefreshTokenDto } from './dto/auth.dto';
import { GenerateSmsOtpDto, VerifySmsOtpDto, ResendSmsOtpDto } from '../sms/dto/sms.dto';

import { AuthService } from './auth.service';
import { CognitoService } from './cognito-sso.service';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { OAuthService } from './oauth.service';
import { ConfirmForgotPasswordDto } from './dto/confirm-forgot-password.dto';
import { VerifyConfirmationCodeDto } from './dto/verify-confirmation-code.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
    private readonly cognitoService: CognitoService,
  ) { }

  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto,
    @Req() req: Request) {
    const clientId = req['clientId'];
    verifyOtpDto.restaurantId = clientId;
    return this.authService.verifyOtpAndSignIn(verifyOtpDto);
  }

  @Post('generate-otp')
  async generateOtp(@Body('email') email: string,
    @Req() req: Request) {
    const clientId = req['clientId'];
    return this.authService.generateOtp(email, clientId);
  }

  @Post('resend-otp')
  async resendOtp(@Body('email') email: string,
    @Req() req: Request) {
    const clientId = req['clientId'];
    return this.authService.resendOtp(email, clientId);
  }

  @Post('generate-sms-otp')
  async generateSmsOtp(@Body() generateSmsOtpDto: GenerateSmsOtpDto,
    @Req() req: Request) {
    const clientId = req['clientId'];
    generateSmsOtpDto.restaurantId = clientId;
    return this.authService.generateSmsOtp(generateSmsOtpDto);
  }

  @Post('verify-sms-otp')
  async verifySmsOtp(@Body() verifySmsOtpDto: VerifySmsOtpDto,
    @Req() req: Request) {
    const clientId = req['clientId'];
    verifySmsOtpDto.restaurantId = clientId;
    return this.authService.verifySmsOtp(verifySmsOtpDto);
  }

  @Post('resend-sms-otp')
  async resendSmsOtp(@Body() resendSmsOtpDto: ResendSmsOtpDto,
    @Req() req: Request) {
    const clientId = req['clientId'];
    resendSmsOtpDto.restaurantId = clientId;
    return this.authService.resendSmsOtp(resendSmsOtpDto);
  }

  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('/leads/signup')
  async leadsSignUp(
    @Body('firstName') firstName: string,
    @Body('lastName') lastName: string,
    @Body('emailId') emailId: string,
    @Body('phoneNumber') phoneNumber: string,
    @Body('password') password: string
  ) {
    return await this.authService.leadsSignUp(firstName, lastName, emailId, phoneNumber, password)
  }

  @Post('regenerate-lead-otp')
  async regenerateLeadOtp(
    @Body('emailId') emailId: string,
  ) {
    return await this.authService.regenrateLeadOtp(emailId)
  }

  @Post('verify-lead-otp')
  async verifyLeadOtp(@Body() body: { emailId: string; otp: string }) {
    return this.authService.verifyLeadOtp(body.emailId, body.otp);
  }


  @Get('cognito/login')
  getLoginUrl(@Query() query: OAuthLoginDto) {
    const loginUrl = this.cognitoService.getHostedUILoginUrl(query.state, query.provider);

    return {
      loginUrl: loginUrl,
      message: 'Redirect user to this URL to initiate OAuth SSO',
      platform: 'web',
      clientId: process.env.COGNITO_CLIENT_ID,
    };
  }

  @Get('cognito/callback')
  async handleCallback(@Query() query: OAuthCallbackDto) {
    try {
      if (!query.code) {
        throw new BadRequestException('Authorization code is required');
      }

      // Step 1: Exchange authorization code for tokens
      const tokenResponse = await this.cognitoService.exchangeCodeForTokens(query.code);

      if (!tokenResponse.id_token) {
        throw new BadRequestException('Cognito did not return id_token');
      }

      // Step 2: Verify the ID token using JWKS
      const userPayload = await this.cognitoService.fetchUserInfo(tokenResponse.id_token);

      // Step 3: Provider for name heuristics (query wins, else infer from token claims)
      userPayload.provider =
        query.identityType ??
        this.oauthService.inferProviderFromPayload(userPayload);

      // Step 4: Extract context from state if possible
      let expectedRestaurantId: string | undefined;
      if (query.state) {
        try {
          const stateObj = JSON.parse(query.state);
          expectedRestaurantId = stateObj.restaurantId;
        } catch (e) {
          // Fallback to literal state string if not JSON
          expectedRestaurantId = query.state;
        }
      }

      // Step 5: Upsert user / admin / lead in MongoDB with validation
      const profile = await this.oauthService.upsertUserFromOAuth(
        userPayload,
        tokenResponse,
        expectedRestaurantId,
      );

      // Step 5: Return profile and tokens
      return {
        message: 'Authentication successful',
        platform: 'web',
        user: {
          userId: profile.subjectId,
          recordType: profile.recordType,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          isEmailVerified: profile.isEmailVerified,
          restaurantId: profile.restaurantId,
        },
        tokens: {
          accessToken: tokenResponse.access_token,
          idToken: tokenResponse.id_token,
          refreshToken: tokenResponse.refresh_token,
          expiresIn: tokenResponse.expires_in,
        },
      };
    } catch (error) {
      console.error('OAuth callback error:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || 'OAuth authentication failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('confirm-forgot-password')
  async confirmForgotPassword(@Body() dto: ConfirmForgotPasswordDto) {
    return this.authService.confirmForgotPassword(
      dto.email,
      dto.confirmationCode,
      dto.newPassword
    );
  }

  @Post('verify-confirmation-code')
  async verifyConfirmationCode(@Body() dto: VerifyConfirmationCodeDto) {
    return this.authService.verifyConfirmationCode(
      dto.email,
      dto.confirmationCode
    );
  }

  @Post('update-password')
  async updatePasswordAfterVerification(@Body() dto: UpdatePasswordDto) {
    return this.authService.updatePasswordAfterVerification(
      dto.email,
      dto.newPassword
    );
  }

  @Post('logout')
  async logout(@Body() body: { accessToken?: string; refreshToken?: string }) {
    return this.authService.logout(body.accessToken, body.refreshToken);
  }
}
