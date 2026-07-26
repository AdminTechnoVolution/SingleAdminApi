import { Controller, Get, Injectable, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Model } from 'mongoose';
import { AdminGuard, SESSION_COOKIE } from './auth';
import { normalizedCountryExpr, normalizedGenderExpr } from './common';
import { Report, Subscription, User, UserDocument } from './database.schemas';
import { SubscriptionsService } from './subscriptions';
import { activityStages } from './activity';

@Injectable()
export class DashboardService {
  private summaryCache: { expiresAt: number; value: Record<string, unknown> } | null = null;

  constructor(
    @InjectModel(User.name) private users: Model<UserDocument>,
    @InjectModel(Report.name) private reports: Model<Report>,
    @InjectModel(Subscription.name) private subscriptions: Model<Subscription>,
    private subscriptionService: SubscriptionsService,
  ) {}

  async summary(): Promise<Record<string, unknown>> {
    if (this.summaryCache && this.summaryCache.expiresAt > Date.now()) return this.summaryCache.value;
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const [totalUsers, totalReports, reportStatuses, countries, activeSubscriptions, genders, activity] = await Promise.all([
      this.users.countDocuments(),
      this.reports.countDocuments(),
      this.reports.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      this.users.aggregate([
        { $project: { country: normalizedCountryExpr } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $facet: {
          top: [{ $limit: 6 }, { $project: { _id: 0, country: '$_id', count: 1 } }],
          metadata: [{ $match: { _id: { $ne: 'Sin identificar' } } }, { $count: 'total' }],
        } },
      ]),
      this.subscriptions.aggregate([...this.subscriptionService.activePipeline(), { $count: 'total' }]),
      this.users.aggregate([
        { $project: {
          category: normalizedGenderExpr,
        } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      this.users.aggregate([
        ...activityStages(),
        { $group: {
          _id: null,
          activeUsersLast7Days: { $sum: { $cond: [{ $gte: ['$lastInteractionAt', daysAgo(7)] }, 1, 0] } },
          activeUsersLast30Days: { $sum: { $cond: [{ $gte: ['$lastInteractionAt', daysAgo(30)] }, 1, 0] } },
          activeUsersLast90Days: { $sum: { $cond: [{ $gte: ['$lastInteractionAt', daysAgo(90)] }, 1, 0] } },
          inactiveUsersOver90Days: { $sum: { $cond: [
            { $and: [{ $gt: ['$lastInteractionAt', new Date(0)] }, { $lt: ['$lastInteractionAt', daysAgo(90)] }] }, 1, 0,
          ] } },
          usersWithoutActivity: { $sum: { $cond: [{ $lte: ['$lastInteractionAt', new Date(0)] }, 1, 0] } },
        } },
      ]),
    ]);
    const value = {
      totalUsers,
      totalCountries: countries[0]?.metadata[0]?.total ?? 0,
      totalReports,
      activeSubscriptions: activeSubscriptions[0]?.total ?? 0,
      reportsByStatus: reportStatuses.map((row) => ({ status: row._id ?? 'unknown', count: row.count })),
      topCountries: countries[0]?.top ?? [],
      usersByGender: ['male', 'female', 'other'].map((gender) => {
        const count = gender === 'other'
          ? (genders.find((row) => row._id === 'other')?.count ?? 0) + (genders.find((row) => row._id === 'unknown')?.count ?? 0)
          : genders.find((row) => row._id === gender)?.count ?? 0;
        return {
          gender,
          count,
          percentage: totalUsers ? Number(((count / totalUsers) * 100).toFixed(2)) : 0,
        };
      }),
      activity: activity[0] ?? {
        activeUsersLast7Days: 0,
        activeUsersLast30Days: 0,
        activeUsersLast90Days: 0,
        inactiveUsersOver90Days: 0,
        usersWithoutActivity: 0,
      },
    };
    this.summaryCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
    return value;
  }
}

@ApiTags('Dashboard') @ApiCookieAuth(SESSION_COOKIE) @UseGuards(AdminGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}
  @Get('summary') summary() { return this.service.summary(); }
}
