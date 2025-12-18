import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

/**
 * AdminGuard - Ensures only admin users can access protected routes
 * Returns HTTP 403 (Forbidden) for non-admin users
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('Admin access denied: No user in request');
      throw new ForbiddenException('Admin access required');
    }

    // Fetch fresh user data to check admin status
    const userRecord = await this.usersService.findOne(user.id);

    if (!userRecord) {
      this.logger.warn(`Admin access denied: User ${user.id} not found`);
      throw new ForbiddenException('Admin access required');
    }

    if (!userRecord.isAdmin) {
      this.logger.warn(`Admin access denied: User ${user.id} (${userRecord.telegramId}) is not an admin`);
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}

