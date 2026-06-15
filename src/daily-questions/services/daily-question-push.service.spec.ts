import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../../notifications/notifications.service';
import { DailyQuestionPushService } from './daily-question-push.service';

describe('DailyQuestionPushService', () => {
  let service: DailyQuestionPushService;
  let notifications: { sendNow: jest.Mock };

  beforeEach(async () => {
    notifications = {
      sendNow: jest.fn().mockResolvedValue({ id: 'notification-job' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyQuestionPushService,
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(DailyQuestionPushService);
  });

  it('uses one stable daily dedupe key per tenant and user', async () => {
    const payload = {
      title: 'Napi kérdőív',
      body: 'Új kérdéseid érkeztek.',
    };

    await service.sendToUsers(
      'tenant-1',
      ['user-1', 'user-2'],
      payload,
      '2026-06-15',
    );
    await service.sendToUsers('tenant-1', ['user-1'], payload, '2026-06-15');

    expect(notifications.sendNow).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dedupeKey: 'tenant-1:daily_question:2026-06-15:user-1',
      }),
    );
    expect(notifications.sendNow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        dedupeKey: 'tenant-1:daily_question:2026-06-15:user-2',
      }),
    );
    expect(notifications.sendNow).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        dedupeKey: 'tenant-1:daily_question:2026-06-15:user-1',
      }),
    );
  });
});
