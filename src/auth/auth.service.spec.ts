import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ActivityLogService } from '../activity/activity-log.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    findByEmailGlobal: jest.Mock;
    resetForgottenPassword: jest.Mock;
  };
  let activity: {
    log: jest.Mock;
    requestMeta: jest.Mock;
  };

  beforeEach(async () => {
    users = {
      findByEmailGlobal: jest.fn(),
      resetForgottenPassword: jest.fn(),
    };
    activity = {
      log: jest.fn(),
      requestMeta: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: {} },
        { provide: ActivityLogService, useValue: activity },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends a reset password for an existing user', async () => {
    const user = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      isDeleted: false,
    };
    users.findByEmailGlobal.mockResolvedValue(user);
    users.resetForgottenPassword.mockResolvedValue(true);

    const result = await service.forgotPassword(' User@Example.com ');

    expect(users.findByEmailGlobal).toHaveBeenCalledWith('user@example.com');
    expect(users.resetForgottenPassword).toHaveBeenCalledWith(user);
    expect(activity.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'AUTH_PASSWORD_RESET_REQUESTED',
        userId: user.id,
      }),
    );
    expect(result.message).toContain('elküldtük');
  });

  it('returns the same response for an unknown email', async () => {
    users.findByEmailGlobal.mockResolvedValue(null);

    const result = await service.forgotPassword('missing@example.com');

    expect(users.resetForgottenPassword).not.toHaveBeenCalled();
    expect(activity.log).not.toHaveBeenCalled();
    expect(result.message).toContain('elküldtük');
  });

  it('does not reset the same email again during the cooldown', async () => {
    const user = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      isDeleted: false,
    };
    users.findByEmailGlobal.mockResolvedValue(user);
    users.resetForgottenPassword.mockResolvedValue(true);

    await service.forgotPassword('user@example.com');
    await service.forgotPassword('user@example.com');

    expect(users.findByEmailGlobal).toHaveBeenCalledTimes(1);
    expect(users.resetForgottenPassword).toHaveBeenCalledTimes(1);
  });
});
