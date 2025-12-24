import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First check if SkipThrottle decorator is used
    const skipThrottle = this.reflector.getAllAndOverride<boolean>('skipThrottle', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipThrottle) {
      return true; // Skip throttling
    }

    // Skip throttling for public read-only GET endpoints
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.route?.path || request.url;

    // Skip all GET requests to public lottery endpoints (no auth required)
    if (method === 'GET') {
      const publicPaths = [
        '/lottery/active',
        '/lottery/latest',
        '/lottery/winners-feed',
        '/lottery/recent-rounds',
        '/lottery/pool-info',
      ];

      for (const publicPath of publicPaths) {
        if (path.includes(publicPath)) {
          return true; // Skip throttling for these public endpoints
        }
      }
    }

    // Use default throttling behavior for other endpoints
    return super.canActivate(context);
  }
}

