import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  AuthMeResponse,
  ChangePasswordInput,
  ChangePasswordResponse,
  ForgotPasswordInput,
  ForgotPasswordResponse,
  IAuthUser,
  LoginInput,
  LoginResponse,
  RegisterInput,
  RegisterResponse,
  ResetPasswordInput,
  ResetPasswordResponse,
} from './auth.types';
import { Auth, AuthUser } from './decorators/auth.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'Authenticate a user' })
  @ApiBody({ type: LoginInput })
  @ApiOkResponse({
    description: 'Returns a signed access token for the authenticated user.',
    type: LoginResponse,
  })
  @ApiBadRequestResponse({ description: 'The request body is invalid.' })
  @ApiUnauthorizedResponse({
    description: 'The provided credentials are invalid.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginInput) {
    return this.auth.login(dto);
  }

  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterInput })
  @ApiCreatedResponse({
    description: 'Creates a user account successfully.',
    type: RegisterResponse,
  })
  @ApiBadRequestResponse({
    description: 'The request body is invalid or the user already exists.',
  })
  @Post('register')
  async register(@Body() dto: RegisterInput) {
    return this.auth.register(dto);
  }

  @ApiOperation({ summary: 'Send a password reset OTP' })
  @ApiBody({ type: ForgotPasswordInput })
  @ApiOkResponse({
    description: 'Returns a generic confirmation after handling the request.',
    type: ForgotPasswordResponse,
  })
  @ApiBadRequestResponse({ description: 'The request body is invalid.' })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordInput) {
    return this.auth.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Reset a password with email, OTP, and new password' })
  @ApiBody({ type: ResetPasswordInput })
  @ApiOkResponse({
    description: 'Updates the user password after a valid OTP check.',
    type: ResetPasswordResponse,
  })
  @ApiBadRequestResponse({
    description: 'The request body is invalid or the OTP is invalid/expired.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordInput) {
    return this.auth.resetPassword(dto);
  }

  @ApiOperation({ summary: 'Change password for the authenticated user' })
  @ApiBearerAuth()
  @ApiBody({ type: ChangePasswordInput })
  @ApiOkResponse({
    description:
      'Updates the authenticated user password after validating the current password.',
    type: ChangePasswordResponse,
  })
  @ApiBadRequestResponse({ description: 'The request body is invalid.' })
  @ApiUnauthorizedResponse({
    description:
      'A valid bearer token is required or the current password is incorrect.',
  })
  @Auth()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.auth.changePassword(dto, user);
  }

  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Returns the current authenticated user.',
    type: AuthMeResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @Auth()
  @Get('me')
  async getAuthUser(@AuthUser() user: IAuthUser) {
    return this.auth.me(user);
  }
}
