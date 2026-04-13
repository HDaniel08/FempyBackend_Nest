import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard:
 * - Controllerre rakva (@UseGuards(JwtAuthGuard)) védi az endpointot.
 * - A JwtStrategy alapján validál.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
