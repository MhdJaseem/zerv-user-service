import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { BadRequestException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  ResendConfirmationCodeCommand,
  ConfirmSignUpCommand,
  RevokeTokenCommand,
  SignUpCommandInput,
  AdminDisableUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand,
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand
}
  from '@aws-sdk/client-cognito-identity-provider';
import { ErrorException } from '../../common/errors/custom-error.exception';

import { IdentityType } from 'src/common/enums/common.enum';
import { AdminRoles, AttributeAccess, AttributeNames, UserTypeEnum } from 'src/common/enums/user.enum';
import { LeadStatus } from 'src/common/enums/leads.enum';
import { Helpers } from '../../common/helpers/common.helpers';
import { RefreshTokenDto, VerifyOtpDto } from './dto/auth.dto';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';

import { SmsService } from '../sms/sms.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from 'src/modules/email/email.service';
import { GenerateSmsOtpDto, VerifySmsOtpDto } from '../sms/dto/sms.dto';
import { ResendSmsOtpDto } from '../sms/dto/sms.dto';
import { isSsoAuthProvider } from 'src/common/utils/auth-provider.util';
import { generateSecretHash } from 'src/common/utils/util';
@Injectable()
export class AuthService {
  private cognitoClient: CognitoIdentityProviderClient;

  private clientId = process.env.COGNITO_CLIENT_ID!;
  private clientSecret = process.env.COGNITO_CLIENT_SECRET!;
  private userPoolId = process.env.COGNITO_USER_POOL_ID!;

  constructor(
    private dbService: IMongoDBServices,
    private sns: AWS.SNS,
    private emailService: EmailService,
    private smsService: SmsService,
    private jwtService: JwtService,
  ) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
    });
  }

  private sanitizeValue(value: any): string {
    if (value === undefined || value === null || value === 'undefined' || value === 'null') {
      return '';
    }
    return String(value).trim();
  }

  //Send the Otp to through aws sms using aws-sdk
  async sendOtpViaSms(phoneNumber: string, otp: string) {
    let formattedPhoneNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      formattedPhoneNumber = `+${phoneNumber}`;
    }

    console.log(`Attempting to send OTP to: ${formattedPhoneNumber}`);

    const params: AWS.SNS.PublishInput = {
      Message: `Your OTP is: ${otp}`,
      PhoneNumber: formattedPhoneNumber,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'Ohana',
        },
      },
    };

    try {
      const result = await this.sns.publish(params).promise();
      console.log('SMS sent successfully:', {
        messageId: result.MessageId,
        phoneNumber: formattedPhoneNumber,
        timestamp: new Date().toISOString()
      });

      return { success: true, otp, messageId: result.MessageId };
    } catch (error) {
      console.error('SNS send error details:', {
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
        phoneNumber: formattedPhoneNumber,
        timestamp: new Date().toISOString()
      });
      return { success: false, error: error.message };
    }
  }

  async generateAndSendOtp(email: string, phoneNumber?: string, restaurantId?: string) {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const user = await this.dbService.user.findOneAndUpdate(
      { email, restaurantId },
      {
        $set: {
          otp,
          userType: UserTypeEnum.CUSTOMER
        }
      }
    );

    const emailContent = `
    <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <h2 style="color: #333;">Welcome ${user?.firstName} ${user?.lastName}!</h2>
        </div>
        <p style="font-size: 16px; color: #555;">
          We're excited to have you join us. To get started, please use the following OTP to verify your email address:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 24px; font-weight: bold; color: #1e88e5; background: #e3f2fd; padding: 12px 24px; border-radius: 8px;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 14px; color: #777; text-align: center;">
          This OTP is valid for the next <strong>1 minute</strong>. Please do not share it with anyone.
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 14px; color: #aaa; text-align: center;">
          If you did not request this email, please ignore it or contact our support team at
          <a href="mailto:zerv@noukha.in" style="color: #1e88e5;">zerv@noukha.in</a>.
        </p>
      </div>
    </div>
  `;

    await this.emailService.sendEmail(email, 'Email Verification OTP', emailContent)
  }

  async verifyOtpAndSignIn(verifyOtpDto: VerifyOtpDto) {
    const { email, otp, restaurantId } = verifyOtpDto;

    const user = await this.dbService.user.findOne({ email, restaurantId: restaurantId ?? undefined });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.otp) {
      throw new BadRequestException('No OTP found. Please request a new OTP');
    }

    if (user.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }
    else {
      return {
        message: 'Email verified successfully',
        user,
      };
    }
  }


  async initiateLeadEmailVerification(email: string): Promise<void> {
    try {
      const command = new SignUpCommand({
        ClientId: process.env.COGNITO_LEADS_APP_CLIENT_ID,
        Username: email?.split('@')[0] || '',
        Password: Helpers.generateTempPassword(),
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: email.split('@')[0] || 'Lead User' },
        ],
      });
      await this.cognitoClient.send(command);
    } catch (error: any) {
      if (error?.name === 'UsernameExistsException') {
        await this.cognitoClient.send(new ResendConfirmationCodeCommand({
          ClientId: process.env.COGNITO_LEADS_APP_CLIENT_ID,
          Username: email?.split('@')[0] || '',
        }));
        return;
      }
      throw error;
    }
  }

  async verifyLeadEmailOtp(email: string, otp: string): Promise<void> {
    try {
      await this.cognitoClient.send(new ConfirmSignUpCommand({
        ClientId: process.env.COGNITO_LEADS_APP_CLIENT_ID,
        Username: email?.split('@')[0] || '',
        ConfirmationCode: otp,
      }));
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Invalid or expired OTP');
    }
  }


  async resendOtp(email: string, restaurantId: string) {
    const user = await this.dbService.user.findOne({ email, restaurantId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.generateAndSendOtp(email, user.phoneNumber, restaurantId);
    return {
      message: 'OTP resent successfully'
    };
  }

  async signUpUserInCognito(phoneNumber: string, name: string, userId: string, email?: string): Promise<void> {
    // When User Pool is configured with phone number alias, 
    // we cannot use phone number as Username. Use userId instead.
    // Phone number will be set as an attribute and can be used for sign-in via alias.
    // Note: custom:userId attribute removed as it's not defined in the User Pool schema
    // and userId is already stored as the Username field.
    const userAttributes: Array<{ Name: string; Value: string }> = [
      { Name: 'phone_number', Value: phoneNumber },
      { Name: 'name', Value: name }
    ];

    // Add email if provided (required by Cognito User Pool configuration)
    // Note: email_verified is a read-only attribute managed by Cognito, cannot be set during signup
    if (email) {
      userAttributes.push({ Name: 'email', Value: email });
    }

    const signUpUserParams: SignUpCommandInput = {
      Username: userId, // Use userId as username instead of phoneNumber
      UserAttributes: userAttributes,
      ValidationData: undefined,
      Password: Helpers.generateTempPassword(),
      ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID
    }
    const signUpUserCommand = new SignUpCommand(signUpUserParams);
    await this.cognitoClient.send(signUpUserCommand);
  }

  async adminDisableLeadUser(leadId: string): Promise<void> {
    const userPoolId = process.env.COGNITO_LEADS_USER_POOL_ID;
    if (!userPoolId) throw new Error('COGNITO_LEADS_USER_POOL_ID is not configured');

    await this.cognitoClient.send(
      new AdminDisableUserCommand({
        UserPoolId: userPoolId,
        Username: leadId,
      }),
    );
  }

  async adminDeleteLeadUser(leadId: string): Promise<void> {
    const userPoolId = process.env.COGNITO_LEADS_USER_POOL_ID;
    if (!userPoolId) throw new Error('COGNITO_LEADS_USER_POOL_ID is not configured');

    await this.cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: leadId,
      }),
    );
  }

  // async signInUser({ phoneNumber, restaurantId }) {
  //   const userDetail = await this.dbService.user.findOne({ phoneNumber, restaurantId });
  //   if (userDetail) {
  //     const initResponse = await this.generateOtp(phoneNumber)
  //     return {
  //       message: 'OTP sent successfully',
  //       user: userDetail,
  //       challengeName: initResponse.ChallengeName,
  //       session: initResponse.Session,
  //     };
  //   } else {
  //     throw new BadRequestException('User does not exist');
  //   }
  // }

  async generateOtp(email: string, restaurantId: string) {
    try {
      const userDetail = await this.dbService.user.findOne({ email, restaurantId });
      if (!userDetail) {
        throw new BadRequestException('User does not exist'); // Let NestJS handle this
      }
      await this.generateAndSendOtp(email, userDetail.phoneNumber, restaurantId);
    } catch (err) {
      if (err instanceof HttpException) {
        throw err; // Re-throw NestJS exceptions so the response remains consistent
      }
      console.log(err);
      throw new ErrorException('Failed to generate OTP');
    }
  }

  async generateSmsOtp(generateSmsOtpDto: GenerateSmsOtpDto) {
    try {
      const { phoneNumber, restaurantId } = generateSmsOtpDto;
      const userDetail = await this.dbService.user.findOne({ phoneNumber, restaurantId });
      if (!userDetail) {
        throw new BadRequestException('User does not exist');
      }

      // Generate 4 digit OTP
      const otp = Math.floor(1000 + Math.random() * 9000).toString();

      // Update user with OTP
      await this.dbService.user.findOneAndUpdate(
        { phoneNumber, restaurantId },
        {
          $set: {
            otp,
            userType: UserTypeEnum.CUSTOMER
          }
        }
      );

      // Send OTP via SMS
      await this.smsService.sendOtpMessage(phoneNumber, otp);

      return {
        message: 'OTP sent successfully to your phone number'
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      console.log(err);
      throw new ErrorException('Failed to generate SMS OTP');
    }
  }

  async verifySmsOtp(verifySmsOtpDto: VerifySmsOtpDto) {
    const { phoneNumber, otp, restaurantId } = verifySmsOtpDto;

    const user = await this.dbService.user.findOne({ phoneNumber, restaurantId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.otp) {
      throw new BadRequestException('No OTP found. Please request a new OTP');
    }

    if (user.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    } else {
      return {
        message: 'Phone number verified successfully',
        user,
      };
    }
  }

  async resendSmsOtp(resendSmsOtpDto: ResendSmsOtpDto) {
    const { phoneNumber, restaurantId } = resendSmsOtpDto;
    const user = await this.dbService.user.findOne({ phoneNumber, restaurantId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.generateSmsOtp(resendSmsOtpDto);
    return {
      message: 'OTP resent successfully'
    };
  }


  // Verify OTP
  // async verifyOTP(verifyOtpDto: VerifyOtpDto) {
  //   const { phoneNumber, code, session, restaurantId } = verifyOtpDto;
  //   try {
  //     const command = new RespondToAuthChallengeCommand({
  //       ChallengeName: 'CUSTOM_CHALLENGE',
  //       ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
  //       ChallengeResponses: {
  //         USERNAME: phoneNumber,
  //         ANSWER: code,
  //       },
  //       Session: session,
  //     });

  //     const response = await this.cognitoClient.send(command);

  //     return {
  //       accessToken: response.AuthenticationResult?.AccessToken,
  //       refreshToken: response.AuthenticationResult?.RefreshToken,
  //       idToken: response.AuthenticationResult?.IdToken,
  //       message: 'Login successful',
  //       user: await this.dbService.user.findOne({ phoneNumber, restaurantId })
  //     };
  //   } catch (error) {
  //     console.log(error);
  //     throw new BadRequestException(error?.message || 'Invalid OTP');
  //   }
  // }

  // Refresh Token
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
        AuthParameters: {
          'REFRESH_TOKEN': refreshTokenDto.refreshToken,
        },
      });

      const response = await this.cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('Failed to refresh token');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // Sign Out
  async signOut(accessToken: string, refreshToken: string) {
    try {
      await this.cognitoClient.send(new RevokeTokenCommand({
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
        Token: refreshToken,
      }));
      try {
        await this.cognitoClient.send(new GlobalSignOutCommand({
          AccessToken: accessToken,
        }))
      } catch (err) {
        console.log(err.message);
      }
      return { message: 'Signed out successfully' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // Resend OTP
  async resendOTP(phoneNumber: string) {
    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
        Username: phoneNumber,
      });

      await this.cognitoClient.send(command);

      return {
        message: 'OTP resent successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // Get User Profile : Promise<IUser>
  async getUserProfile(accessToken: string) {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response: any = await this.cognitoClient.send(command);

      const attributes = response.UserAttributes.reduce((acc, attr) => {
        acc[attr.Name] = attr.Value;
        return acc;
      }, {});

      return {
        id: response.Username,
        username: attributes['preferred_username'],
        phoneNumber: attributes['phone_number'],
        enabled: true,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async generateTemporaryOtp(email: string): Promise<void> {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 60 * 1000);
    try {
      const otpSession = await this.dbService.otpSessions.findOneAndUpdate(
        { email },
        {
          $set: {
            otpCode: otp,
            expiresAt,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      if (!otpSession) {
        throw new BadRequestException('Failed to generate temporary OTP');
      }

      if (otpSession.expiresAt < new Date()) {
        throw new BadRequestException('OTP has expired');
      }

      if (otpSession.otpCode !== otp) {
        throw new BadRequestException('Invalid OTP');
      }
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Failed to generate temporary OTP');
    }

    const emailContent = `
    <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <h2 style="color: #333;">Your verification code</h2>
        </div>
        <p style="font-size: 16px; color: #555;">
          Use this one-time code to verify your email:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 24px; font-weight: bold; color: #1e88e5; background: #e3f2fd; padding: 12px 24px; border-radius: 8px;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 14px; color: #777; text-align: center;">
          This code expires in <strong>1 minute</strong>. Do not share it with anyone.
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 14px; color: #aaa; text-align: center;">
          If you did not request this email, you can ignore it or contact
          <a href="mailto:zerv@noukha.in" style="color: #1e88e5;">zerv@noukha.in</a>.
        </p>
      </div>
    </div>
  `;

    await this.emailService.sendEmail(email, 'Your verification code', emailContent);
  }

  async verifyTemporaryOtp(emailId: string, otp: string): Promise<any> {
    try {
      const OtpSession = await this.dbService.otpSessions.findOne({ email: emailId });

      if (!OtpSession) {
        throw new BadRequestException('OTP not found');
      }
      if (OtpSession.expiresAt < new Date()) {
        throw new BadRequestException('OTP has expired. Please request a new OTP');
      }
      if (OtpSession.otpCode !== otp) {
        throw new BadRequestException('Invalid OTP. Please request a new OTP');
      }

      await this.dbService.otpSessions.findOneAndDelete({ email: emailId }, { new: true });

      await this.dbService.lead.findOneAndUpdate({ email: emailId }, { $set: { isEmailVerified: true } });

      return { isVerified: true };
    } catch (error) {
      throw new BadRequestException(error?.message || 'Failed to verify temporary OTP');
    }
  }

  // Google Onboarding Handling
  async getGoogleOnboardingData(req: any) {
    if (!req.user) {
      throw new BadRequestException('No user from google');
    }

    const { email, firstName, lastName, phoneNumber, picture } = req.user;

    const existingUser: any =
      await this.dbService.user.findOne({ email }) ||
      await this.dbService.adminUser.findOne({ email }) ||
      await this.dbService.lead.findOne({ email });

    return {
      exists: !!existingUser,
      user: {
        email: this.sanitizeValue(existingUser?.email || email),
        firstName: this.sanitizeValue(existingUser?.firstName || firstName),
        lastName: this.sanitizeValue(existingUser?.lastName || lastName),
        phoneNumber: this.sanitizeValue(existingUser?.phoneNumber || phoneNumber || ''),
        picture: this.sanitizeValue(existingUser?.picture || picture || ''),
      }
    };
  }

  // Google Login Handling
  async googleLogin(req: any) {
    if (!req.user) {
      throw new BadRequestException('No user from google');
    }

    const { email, firstName, lastName } = req.user;

    const existingUser: any =
      await this.dbService.user.findOne({ email }) ||
      await this.dbService.adminUser.findOne({ email }) ||
      await this.dbService.lead.findOne({ email });

    let user: any = existingUser;
    let isNewlyCreated = false;

    if (!user) {
      const role = AdminRoles.ADMIN;
      const abilities: any[] = [];
      
      const restaurantId = existingUser?.restaurantId;
      if (restaurantId) {
        for (const attributeName of Object.values(AttributeNames)) {
          abilities.push({
            attributeName,
            attributeAccess: [AttributeAccess.ALL],
          });
        }
      }

      user = await this.dbService.lead.create({
        email,
        firstName,
        lastName,
        password: Helpers.generateTempPassword(),
        phoneNumber: 'NA',
        role,
        abilities,
        leadStatus: LeadStatus.PENDING,
        authProvider: IdentityType.Google,
        isEmailVerified: true,
      } as any);
      isNewlyCreated = true;
    } else if (!user.isEmailVerified) {
      if (user.leadId) {
        await this.dbService.lead.findOneAndUpdate({ email }, { $set: { isEmailVerified: true } });
      } else if (user.adminId) {
        await this.dbService.adminUser.findOneAndUpdate({ email }, { $set: { isEmailVerified: true } });
      } else {
        await this.dbService.user.findOneAndUpdate({ email }, { $set: { isEmailVerified: true } });
      }
      user.isEmailVerified = true;
    }

    let restaurantDetails: any = null;
    const restaurantId = user?.restaurantId;
    if (restaurantId) {
      restaurantDetails = await this.dbService.restaurant.findOne({ restaurantId }) || null;
    }

    return {
      message: 'Google login successful',
      isNewlyCreated,
      user: {
        email: user.email || email,
        firstName: user.firstName || firstName,
        lastName: user.lastName || lastName,
        restaurantId: user.restaurantId || null,
      },
      restaurantDetails,
    };
  }

  // Generate JWT access and refresh tokens
  async generateTokens(user: any) {
    const payload = {
      sub: user.userId,
      email: user.email,
      userType: user.userType,
      restaurantId: user.restaurantId
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_TOKEN_SECRET,
        expiresIn: '1h',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }


  async leadsSignUp(firstName: string, lastName: string, emailId: string, phoneNumber: string, password: string) {
    if (!emailId || !phoneNumber || !password) {
      throw new BadRequestException(`Provide the valid ${!emailId ? 'emailId' : !phoneNumber ? 'phoneNumber' : 'password'}`)
    }

    const existingLeadUser = await this.dbService.lead.findOne({ email: emailId });
    const existingAdminUser = await this.dbService.user.findOne({ email: emailId });

    if (existingAdminUser?.isEmailVerified) {
      throw new BadRequestException('User already exists and is verified');
    }

    if (existingLeadUser?.isEmailVerified) {
      throw new BadRequestException('User already exists and is verified');
    }

    const role = AdminRoles.ADMIN;
    const abilities: any[] = [];

    // Only populate if a restaurantId is already available (rare for new signups)
    if (emailId && (await this.dbService.lead.findOne({ email: emailId }))?.restaurantId) {
      for (const attributeName of Object.values(AttributeNames)) {
        abilities.push({
          attributeName,
          attributeAccess: [AttributeAccess.ALL],
        });
      }
    }

    const leadData = {
      firstName: this.sanitizeValue(firstName),
      lastName: this.sanitizeValue(lastName),
      email: emailId,
      phoneNumber: this.sanitizeValue(phoneNumber),
      password,
      role,
      abilities,
      leadStatus: LeadStatus.PENDING,
      authProvider: 'email',
    };

    if (existingLeadUser) {
      await this.dbService.lead.findOneAndUpdate(
        { email: emailId },
        { $set: leadData }
      );
    } else {
      await this.dbService.lead.create(leadData);
    }

    await this.generateTemporaryOtp(emailId);

    return { message: 'User created successfully. Verify OTP.' };
  }

  async verifyLeadOtp(emailId: string, otp: string) {
    if (!emailId || !otp) {
      throw new BadRequestException(`Provide the valid ${!emailId ? 'emailId' : 'otp'}`)
    }

    try {
      return await this.verifyTemporaryOtp(emailId, otp);
    } catch (error) {
      throw new BadRequestException('Failed to verify lead email OTP: ' + error.message);
    }
  }

  async regenrateLeadOtp(emailId: string) {
    if (!emailId) {
      throw new BadRequestException('Provide the valid emailId')
    }

    const existingLeadUser = await this.dbService.lead.findOne({ email: emailId });
    const existingAdminUser = await this.dbService.user.findOne({ email: emailId });

    if (existingAdminUser?.isEmailVerified) {
      throw new BadRequestException('User already exists and is verified');
    }

    if (existingLeadUser?.isEmailVerified) {
      throw new BadRequestException('User already exists and is verified');
    }

    // resend OTP if not verified
    if (existingLeadUser && !existingLeadUser.isEmailVerified) {
      await this.generateTemporaryOtp(emailId);
      return { message: 'OTP resent. Please verify your email.' };
    }
  }


  /**
  * Ensure user has a password in Cognito for forgot password flow
  * If user exists but has no password (SSO user), sets a dummy password
  * If user doesn't exist, creates user with dummy password
  * This enables seamless forgot password flow for SSO users
  */
  async ensureUserHasPasswordForForgotPassword(email: string): Promise<void> {
    const dummyPassword = `Aa1!${crypto.randomBytes(24).toString('base64url')}`;

    try {
      // Check if user exists in Cognito
      let userExists = false;

      let userStatus: string | null = null;
      try {
        const getUserResponse = await this.cognitoClient.send(
          new AdminGetUserCommand({
            UserPoolId: this.userPoolId,
            Username: email,
          })
        );
        userExists = true;
        userStatus = getUserResponse.UserStatus || null;
        console.log(`User ${email} exists in Cognito with status: ${userStatus}`);
      } catch (getUserErr: any) {
        console.error(getUserErr);
        if (getUserErr.name === 'UserNotFoundException') {
          console.log(`User ${email} doesn't exist in Cognito, will create with dummy password`);
          userExists = false;
        } else {
          console.log(`Error checking user ${email}:`, getUserErr.message);
          throw getUserErr;
        }
      }

      if (userExists) {
        // User exists (likely SSO user), set dummy password to enable forgot password flow
        // This won't break SSO login as Cognito supports both SSO and password auth
        console.log(`Setting dummy password for existing user ${email} to enable forgot password flow`);
        try {
          // Ensure email attribute is properly set and verified
          try {
            await this.cognitoClient.send(
              new AdminUpdateUserAttributesCommand({
                UserPoolId: this.userPoolId,
                Username: email,
                UserAttributes: [
                  { Name: 'email', Value: email },
                  { Name: 'email_verified', Value: 'true' },
                ],
              }),
            );
            console.log(`Email attribute and verification status set for ${email}`);
          } catch (attrErr: any) {
            console.log(`Failed to update email attribute for ${email}:`, attrErr.message);
            // Continue anyway - try to set password
          }

          // Set password as PERMANENT to ensure user is in CONFIRMED status
          // This is required for forgot password flow to work
          // SSO users are typically already CONFIRMED, but this ensures it
          await this.cognitoClient.send(
            new AdminSetUserPasswordCommand({
              UserPoolId: this.userPoolId,
              Username: email,
              Password: dummyPassword,
              Permanent: true, // Set as permanent to ensure user is in CONFIRMED status (required for forgot password)
            }),
          );
          console.log(`Permanent dummy password set successfully for ${email} - user is now CONFIRMED`);

          // Confirm the user signup (should work now that password is permanent)
          try {
            await this.cognitoClient.send(
              new AdminConfirmSignUpCommand({
                UserPoolId: this.userPoolId,
                Username: email,
              }),
            );
            console.log(`User confirmed for ${email}`);
          } catch (verifyErr: any) {
            // User might already be confirmed after setting permanent password
            console.log(`User confirmation status: ${verifyErr.message}`);
            // Don't throw - user is likely already confirmed
          }
        } catch (setPasswordErr: any) {
          // If setting password fails, user might already have a password - that's fine
          if (setPasswordErr.name === 'InvalidPasswordException' || setPasswordErr.message?.includes('password')) {
            console.log(`User ${email} already has a password or password setting failed, proceeding with forgot password flow`);
            // Continue anyway - user might already have a password
          } else {
            throw setPasswordErr;
          }
        }
      } else {
        // User doesn't exist in Cognito, create with dummy password using AdminCreateUser
        // This ensures email is properly registered and verified
        console.log(`Creating new Cognito user ${email} with dummy password using AdminCreateUser`);

        try {
          // Use AdminCreateUser to create user without temporary password
          // We'll set the password as permanent to put user in CONFIRMED status
          await this.cognitoClient.send(
            new AdminCreateUserCommand({
              UserPoolId: this.userPoolId,
              Username: email,
              UserAttributes: [
                { Name: 'email', Value: email },
              ],
              MessageAction: 'SUPPRESS', // Don't send welcome email
              // Don't set TemporaryPassword - we'll set permanent password directly
            }),
          );
          console.log(`User created in Cognito for ${email}`);

          // Set email attribute and verify email explicitly
          try {
            await this.cognitoClient.send(
              new AdminUpdateUserAttributesCommand({
                UserPoolId: this.userPoolId,
                Username: email,
                UserAttributes: [
                  { Name: 'email', Value: email },
                  { Name: 'email_verified', Value: 'true' },
                ],
              }),
            );
            console.log(`Email attribute and verification status set for ${email}`);
          } catch (attrErr: any) {
            console.log(`Failed to update email attribute for ${email}:`, attrErr.message);
            // Continue anyway
          }

          // Set the password as PERMANENT to move user to CONFIRMED status
          // This is required for forgot password flow to work
          // The password is still a dummy that user will reset via forgot password
          try {
            await this.cognitoClient.send(
              new AdminSetUserPasswordCommand({
                UserPoolId: this.userPoolId,
                Username: email,
                Password: dummyPassword,
                Permanent: true, // Set as permanent to put user in CONFIRMED status (required for forgot password)
              }),
            );
            console.log(`Permanent password set for ${email} - user is now CONFIRMED`);
          } catch (passwordErr: any) {
            console.log(`Failed to set password for ${email}:`, passwordErr.message);
            throw passwordErr; // This is critical, so throw
          }

          // Confirm the user signup (should work now that password is permanent)
          try {
            await this.cognitoClient.send(
              new AdminConfirmSignUpCommand({
                UserPoolId: this.userPoolId,
                Username: email,
              }),
            );
            console.log(`User confirmed for ${email}`);
          } catch (confirmErr: any) {
            // User might already be confirmed after setting permanent password
            console.log(`User confirmation status: ${confirmErr.message}`);
            // Don't throw - user is likely already confirmed
          }
        } catch (createErr: any) {
          // If user already exists (race condition), try to set password and verify email
          if (createErr.name === 'UsernameExistsException' || createErr.name === 'AliasExistsException') {
            console.log(`User ${email} was created by another process, setting dummy password and verifying email`);
            try {
              // Ensure email attribute is set and verified first
              await this.cognitoClient.send(
                new AdminUpdateUserAttributesCommand({
                  UserPoolId: this.userPoolId,
                  Username: email,
                  UserAttributes: [
                    { Name: 'email', Value: email },
                    { Name: 'email_verified', Value: 'true' },
                  ],
                }),
              );
              console.log(`Email attribute and verification status set for ${email}`);

              // Set password as PERMANENT to ensure user is in CONFIRMED status
              await this.cognitoClient.send(
                new AdminSetUserPasswordCommand({
                  UserPoolId: this.userPoolId,
                  Username: email,
                  Password: dummyPassword,
                  Permanent: true, // Set as permanent to ensure user is in CONFIRMED status
                }),
              );
              console.log(`Permanent password set for ${email} - user is now CONFIRMED`);

              // Confirm the user signup (should work now that password is permanent)
              try {
                await this.cognitoClient.send(
                  new AdminConfirmSignUpCommand({
                    UserPoolId: this.userPoolId,
                    Username: email,
                  }),
                );
                console.log(`User confirmed for ${email}`);
              } catch (confirmErr: any) {
                // User might already be confirmed after setting permanent password
                console.log(`User confirmation status: ${confirmErr.message}`);
              }
            } catch (updateErr: any) {
              console.log(`Failed to update user ${email}:`, updateErr.message);
              // Continue anyway
            }
          } else {
            throw createErr;
          }
        }
      }
    } catch (err: any) {
      console.log('Error in ensureUserHasPasswordForForgotPassword:', err.message);
      // Don't throw - allow forgot password flow to proceed even if this fails
      // Cognito might handle it gracefully
    }
  }

  async cognitoCallforgotPassword(email: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      const response = await this.cognitoClient.send(
        new ForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
          SecretHash: secretHash,
        }),
      );

      return {
        message: 'Password reset code sent successfully',
        destination: response.CodeDeliveryDetails?.Destination,
        deliveryMedium: response.CodeDeliveryDetails?.DeliveryMedium,
      };
    } catch (err) {
      console.log('Error in forgotPassword:', err.message);
      throw new BadRequestException(err.message);
    }
  }

  async generateAndSendForgotPasswordOtp(email: string): Promise<void> {
    console.log(`[AuthService] Generating forgot password OTP for: ${email}`);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minute expiration

    try {
      await this.dbService.otpSessions.findOneAndUpdate(
        { email },
        {
          $set: {
            otpCode: otp,
            expiresAt,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );
      console.log(`[AuthService] OTP ${otp} saved to DB for: ${email}`);
    } catch (error: any) {
      console.error(`[AuthService] Failed to save OTP to DB for ${email}:`, error.message);
      throw new BadRequestException('Failed to generate reset OTP');
    }

    const emailContent = `
    <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <h2 style="color: #333;">Password Reset Request</h2>
        </div>
        <p style="font-size: 16px; color: #555;">
          We received a request to reset your password. Use the following code to proceed:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 24px; font-weight: bold; color: #1e88e5; background: #e3f2fd; padding: 12px 24px; border-radius: 8px;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 14px; color: #777; text-align: center;">
          This code expires in <strong>1 minute</strong>. If you did not request this, please ignore this email.
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 14px; color: #aaa; text-align: center;">
          Need help? Contact <a href="mailto:zerv@noukha.in" style="color: #1e88e5;">zerv@noukha.in</a>.
        </p>
      </div>
    </div>
  `;

    console.log(`[AuthService] Calling emailService.sendEmail for: ${email}`);
    try {
      await this.emailService.sendEmail(email, 'Password Reset Code', emailContent);
      console.log(`[AuthService] emailService.sendEmail call successful for: ${email}`);
    } catch (err) {
      console.error(`[AuthService] emailService.sendEmail failed for ${email}:`, err.message);
      throw err;
    }
  }

  async forgotPassword(email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    try {
      fs.appendFileSync('forgot-password-debug.log', `${new Date().toISOString()} - Hit for ${email}\n`);
    } catch (e) {}

    const { lead, adminUser, normalUser } = await this.findAuthRecordsByEmail(email);
    this.requireAuthSubject(lead, adminUser, normalUser);

    this.requireEmailVerifiedForPasswordReset(lead, adminUser);

    // Ensure user has a password entry in Cognito (especially important for SSO users or users missing from Cognito)
    await this.ensureUserHasPasswordForForgotPassword(email);

    // Instead of relying on Cognito's internal email sending (which might fail silently or be unconfigured),
    // we use our own robust email service to send the OTP.
    await this.generateAndSendForgotPasswordOtp(email);

    return {
      message: 'Password reset code sent successfully (Internal Service)',
      destination: email,
      deliveryMedium: 'EMAIL',
    };
  }

  /**
   * Lead first, then admin (if no active lead), then customer user — same as forgot-password.
   */
  private async findAuthRecordsByEmail(email: string) {
    const lead = await this.dbService.lead.findOne({
      email,
      isDeleted: { $in: [null, false] },
    } as any);

    const adminUser = lead
      ? null
      : await this.dbService.adminUser.findOne({
          email,
          isDeleted: { $in: [null, false] },
        } as any);

    const normalUser =
      lead || adminUser
        ? null
        : await this.dbService.user.findOne({ email });

    return { lead, adminUser, normalUser };
  }

  private requireAuthSubject(
    lead: unknown,
    adminUser: unknown,
    normalUser: unknown,
  ): void {
    if (!lead && !adminUser && !normalUser) {
      throw new BadRequestException('User not found');
    }
  }

  /** Email verification rules aligned with forgotPassword (lead vs admin; customer skipped). */
  private requireEmailVerifiedForPasswordReset(lead: any, adminUser: any): void {
    if (lead && !lead.isEmailVerified) {
      throw new BadRequestException('Email not verified. Please verify your email first.');
    }
    if (!lead && adminUser && !adminUser.isEmailVerified) {
      throw new BadRequestException('Email not verified. Please verify your email first.');
    }
  }

  private async persistLocalPasswordAfterCognitoReset(
    email: string,
    newPassword: string,
    lead: any,
    adminUser: any,
    normalUser: any,
  ): Promise<void> {
    if (lead) {
      await this.dbService.lead.findOneAndUpdate(
        { leadId: lead.leadId },
        { $set: { password: newPassword, authProvider: 'email' } },
      );
    } else if (adminUser) {
      await this.dbService.adminUser.findOneAndUpdate(
        { adminId: adminUser.adminId },
        { $set: { password: newPassword, authProvider: 'email' } },
      );
    } else if (normalUser) {
      await this.dbService.user.findOneAndUpdate(
        { email },
        { $set: { password: newPassword, authProvider: 'email' } },
      );
    }
  }

  async confirmForgotPassword(email: string, confirmationCode: string, newPassword: string) {
    if (!email || !confirmationCode || !newPassword) {
      throw new BadRequestException('Email, confirmation code, and new password are required');
    }

    const { lead, adminUser, normalUser } = await this.findAuthRecordsByEmail(email);
    this.requireAuthSubject(lead, adminUser, normalUser);
    this.requireEmailVerifiedForPasswordReset(lead, adminUser);

    // Verify against our local OTP session instead of Cognito's
    const otpSession = await this.dbService.otpSessions.findOne({ email });
    if (!otpSession) {
      throw new BadRequestException('Reset code not found or expired. Please request a new one.');
    }
    if (otpSession.expiresAt < new Date()) {
      throw new BadRequestException('Reset code has expired.');
    }
    if (otpSession.otpCode !== confirmationCode) {
      throw new BadRequestException('Invalid reset code.');
    }

    // 1. ALWAYS update the local MongoDB password first. 
    // This ensures that our local database is the source of truth for the reset.
    await this.persistLocalPasswordAfterCognitoReset(email, newPassword, lead, adminUser, normalUser);

    // 2. Attempt to sync with Cognito, but don't let it block the flow if it fails.
    // If the user is an SSO user (Google/Apple), they don't even have a Cognito password to reset.
    const authProvider = lead?.authProvider || adminUser?.authProvider || normalUser?.authProvider || 'email';
    const isSso = authProvider !== 'email';

    if (!isSso) {
      try {
        // Determine the correct user pool ID
        let primaryPoolId = this.userPoolId;
        if (normalUser) {
          primaryPoolId = process.env.COGNITO_CUSTOMER_USER_POOL_ID || primaryPoolId;
        }
        await this.cognitoUpdatePasswordAfterVerification(email, newPassword, primaryPoolId);
      } catch (cognitoErr) {
        console.warn(`[AuthService] Optional Cognito password sync failed for ${email}:`, cognitoErr.message);
        // We continue anyway because the local DB is updated.
      }
    } else {
      console.log(`[AuthService] Skipping Cognito password sync for SSO user: ${email} (${authProvider})`);
    }

    // Success - remove the OTP session
    await this.dbService.otpSessions.findOneAndDelete({ email });

    return {
      message: 'Password updated successfully',
    };
  }

  async cognitoConfirmForgotPassword(email: string, confirmationCode: string, newPassword: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      await this.cognitoClient.send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: confirmationCode,
          Password: newPassword,
          SecretHash: secretHash,
        }),
      );

      return {
        message: 'Password reset successful',
      };
    } catch (err) {
      console.log('Error in confirmForgotPassword:', err.message);
      throw new BadRequestException(err.message);
    }
  }

  async verifyConfirmationCode(email: string, confirmationCode: string) {
    const { lead, adminUser, normalUser } = await this.findAuthRecordsByEmail(email);
    this.requireAuthSubject(lead, adminUser, normalUser);
    this.requireEmailVerifiedForPasswordReset(lead, adminUser);

    // Verify against our local OTP session
    const otpSession = await this.dbService.otpSessions.findOne({ email });
    if (!otpSession) {
      throw new BadRequestException('Reset code not found or expired.');
    }
    if (otpSession.expiresAt < new Date()) {
      throw new BadRequestException('Reset code has expired.');
    }
    if (otpSession.otpCode !== confirmationCode) {
      throw new BadRequestException('Invalid reset code.');
    }

    return {
      message: 'Confirmation code verified successfully',
      verified: true,
    };
  }

  async cognitoVerifyConfirmationCode(email: string, confirmationCode: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      // We'll use a temporary password to verify the code, then immediately reset it
      const tempPassword = 'TempPass123!';

      await this.cognitoClient.send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: confirmationCode,
          Password: tempPassword,
          SecretHash: secretHash,
        }),
      );

      return {
        message: 'Confirmation code verified successfully',
        verified: true,
      };
    } catch (err) {
      console.log('Error in verifyConfirmationCode:', err.message);
      throw new BadRequestException(err.message);
    }
  }

  async updatePasswordAfterVerification(email: string, newPassword: string) {
    const { lead, adminUser, normalUser } = await this.findAuthRecordsByEmail(email);
    this.requireAuthSubject(lead, adminUser, normalUser);
    this.requireEmailVerifiedForPasswordReset(lead, adminUser);

    const result = await this.cognitoUpdatePasswordAfterVerification(email, newPassword);

    await this.persistLocalPasswordAfterCognitoReset(email, newPassword, lead, adminUser, normalUser);

    return result;
  }

  async cognitoUpdatePasswordAfterVerification(email: string, newPassword: string, userPoolId?: string) {
    const primaryPoolId = userPoolId || this.userPoolId;
    const secondaryPoolId = primaryPoolId === this.userPoolId ? process.env.COGNITO_CUSTOMER_USER_POOL_ID : this.userPoolId;
    
    const poolsToTry = [primaryPoolId, secondaryPoolId].filter(Boolean);
    let lastError: any;

    for (const poolId of poolsToTry) {
      try {
        console.log(`[AuthService] Attempting AdminSetUserPassword for ${email} in pool ${poolId}`);
        await this.cognitoClient.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: poolId!,
            Username: email,
            Password: newPassword,
            Permanent: true,
          }),
        );
        console.log(`[AuthService] Successfully updated password for ${email} in pool ${poolId}`);
        return { message: 'Password updated successfully' };
      } catch (err) {
        lastError = err;
        // If the pool itself doesn't exist or the user isn't there, we just log it and move on
        if (err.name === 'ResourceNotFoundException' || err.name === 'UserNotFoundException' || err.message.includes('does not exist')) {
          console.log(`[AuthService] Pool ${poolId} not found or user ${email} missing in this pool.`);
          continue;
        }
        // For other errors (like connection issues), we rethrow to be caught by the non-blocking wrapper
        throw err;
      }
    }

    throw new Error(lastError?.message || 'User not found in any configured Cognito pools.');
  }

  async logout(accessToken?: string, refreshToken?: string) {
    // Both tokens are optional; use whichever is provided
    // If neither is provided, return a graceful bad request
    if (!accessToken && !refreshToken) {
      throw new BadRequestException('Either accessToken or refreshToken is required');
    }

    const result = await this.cognitoLogout({ accessToken, refreshToken });
    return result;
  }

  async cognitoLogout(options: { accessToken?: string; refreshToken?: string }) {
    const { accessToken, refreshToken } = options || {};
    try {
      // Additionally, if access token is provided, perform a global sign-out
      if (accessToken) {
        try {
          await this.cognitoClient.send(
            new GlobalSignOutCommand({
              AccessToken: accessToken,
            }),
          );
        } catch (atErr) {
          // If access token is invalid/revoked/expired, treat as non-fatal
          const msg = atErr?.message || '';
          const name = atErr?.name || '';
          const nonFatal =
            name === 'NotAuthorizedException' ||
            msg.includes('Access Token has been revoked') ||
            msg.includes('Invalid Access Token') ||
            msg.includes('expired');
          if (!nonFatal) throw atErr;
        }
      }

      return { message: 'Logout successful' };
    } catch (err) {
      console.log('Error in logout:', err.message);
      throw new BadRequestException(err.message);
    }
  }
}