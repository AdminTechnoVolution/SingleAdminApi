import { Model } from 'mongoose';
import { DashboardService } from './dashboard';
import { Report, Subscription, User, UserDocument } from './database.schemas';
import { SubscriptionsService } from './subscriptions';

describe('DashboardService', () => {
  it('counts missing platform values as Android and returns platform totals', async () => {
    const aggregate = jest.fn((pipeline: unknown[]) => {
      if (JSON.stringify(pipeline).includes('"$platform"')) {
        return Promise.resolve([
          { _id: 'Android', count: 4 },
          { _id: 'iOS', count: 3 },
        ]);
      }
      return Promise.resolve([]);
    });
    const users = { countDocuments: jest.fn().mockResolvedValue(7), aggregate };
    const reports = { countDocuments: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue([]) };
    const subscriptions = { aggregate: jest.fn().mockResolvedValue([]) };
    const subscriptionService = { activePipeline: jest.fn().mockReturnValue([]) };
    const service = new DashboardService(
      users as unknown as Model<UserDocument>,
      reports as unknown as Model<Report>,
      subscriptions as unknown as Model<Subscription>,
      subscriptionService as unknown as SubscriptionsService,
    );

    const summary = await service.summary();
    const platformPipeline = aggregate.mock.calls
      .map(([pipeline]) => pipeline)
      .find((pipeline) => JSON.stringify(pipeline).includes('"$platform"'));

    expect(summary.usersByPlatform).toEqual({ android: 4, ios: 3 });
    expect(platformPipeline).toContainEqual({
      $group: { _id: { $ifNull: ['$platform', 'Android'] }, count: { $sum: 1 } },
    });
  });

  it('counts active users in the last 30 days from users.lastActivityAt', async () => {
    const countDocuments = jest.fn((filter?: Record<string, unknown>) => Promise.resolve(filter && 'lastActivityAt' in filter ? 3 : 7));
    const users = { countDocuments, aggregate: jest.fn().mockResolvedValue([]) };
    const reports = { countDocuments: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue([]) };
    const subscriptions = { aggregate: jest.fn().mockResolvedValue([]) };
    const subscriptionService = { activePipeline: jest.fn().mockReturnValue([]) };
    const service = new DashboardService(
      users as unknown as Model<UserDocument>,
      reports as unknown as Model<Report>,
      subscriptions as unknown as Model<Subscription>,
      subscriptionService as unknown as SubscriptionsService,
    );

    const before = Date.now();
    const summary = await service.summary();

    expect(summary.activity).toEqual({ activeUsersLast30Days: 3 });
    const filter = countDocuments.mock.calls.map(([value]) => value).find((value) => value && 'lastActivityAt' in value) as { lastActivityAt: { $gte: Date } };
    const since = filter.lastActivityAt.$gte.getTime();
    expect(before - since).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000 - 1000);
    expect(before - since).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);
    expect(JSON.stringify(users.aggregate.mock.calls)).not.toContain('lastInteractionAt');
  });
});
