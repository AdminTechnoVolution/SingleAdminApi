import {
  Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get,
  Injectable, Post, Req, Res, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString } from 'class-validator';
import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';

export const SESSION_COOKIE = 'single_admin_session';
type AdminClaims = { sub: string; email: string; name?: string; picture?: string };

export class GoogleLoginDto { @IsString() credential!: string; }

@Injectable()
export class AuthService {
  private readonly google: OAuth2Client;
  private readonly allowedEmails: Set<string>;
  constructor(private config: ConfigService, private jwt: JwtService) {
    this.google = new OAuth2Client(config.getOrThrow('GOOGLE_CLIENT_ID'));
    this.allowedEmails = new Set(
      config.getOrThrow<string>('ADMIN_EMAILS').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
    );
  }

  async login(credential: string) {
    const ticket = await this.google.verifyIdToken({
      idToken: credential,
      audience: this.config.getOrThrow('GOOGLE_CLIENT_ID'),
    }).catch(() => { throw new UnauthorizedException('Token de Google inválido'); });
    const payload = ticket.getPayload();
    const email = payload?.email?.trim().toLowerCase();
    if (!payload?.sub || !email || !payload.email_verified) {
      throw new UnauthorizedException('La cuenta de Google no está verificada');
    }
    if (!this.allowedEmails.has(email)) throw new ForbiddenException('Este correo no tiene acceso administrativo');
    const admin: AdminClaims = { sub: payload.sub, email, name: payload.name, picture: payload.picture };
    return { admin, token: await this.jwt.signAsync(admin) };
  }

  cookieOptions() {
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE', 'lax');
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('COOKIE_SECURE', false),
      sameSite,
      maxAge: this.config.get<number>('SESSION_TTL', 3600) * 1000,
      path: '/',
    } as const;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { admin?: AdminClaims }>();
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('Sesión requerida');
    try {
      req.admin = await this.jwt.verifyAsync<AdminClaims>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Sesión inválida o vencida');
    }
  }
}

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google')
  async google(@Body() body: GoogleLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(body.credential);
    res.cookie(SESSION_COOKIE, result.token, this.auth.cookieOptions());
    return result.admin;
  }

  @ApiCookieAuth(SESSION_COOKIE) @UseGuards(AdminGuard) @Get('me')
  me(@Req() req: Request & { admin?: AdminClaims }) { return req.admin; }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { ...this.auth.cookieOptions(), maxAge: undefined });
    return { success: true };
  }
}
