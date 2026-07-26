import { Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Model, PipelineStage } from 'mongoose';
import { AdminGuard, SESSION_COOKIE } from './auth';
import { pageResult, PaginationDto, safeRegex } from './common';
import { Subscription } from './database.schemas';

@Injectable()
export class SubscriptionsService {
  constructor(@InjectModel(Subscription.name) private subscriptions: Model<Subscription>) {}

  activePipeline(now = new Date()): PipelineStage[] {
    return [
      { $match: { 'paymentInfo.fromDate': { $lte: now }, 'paymentInfo.toDate': { $gt: now } } },
      { $sort: { 'paymentInfo.toDate': -1 } },
      { $group: { _id: '$userId', subscription: { $first: '$$ROOT' } } },
    ];
  }

  async active(query: PaginationDto) {
    const pipeline: PipelineStage[] = [
      ...this.activePipeline(),
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $set: { user: { $arrayElemAt: ['$user', 0] } } },
      { $match: { user: { $ne: null } } },
    ];
    if (query.search) pipeline.push({ $match: { $or: [
      { 'user.email': { $regex: safeRegex(query.search), $options: 'i' } },
      { 'user.userInfo.fullName': { $regex: safeRegex(query.search), $options: 'i' } },
    ] } });
    pipeline.push(
      { $sort: { 'subscription.paymentInfo.toDate': 1 } },
      { $project: {
        _id: '$subscription._id', subscriptionId: '$subscription.subscriptionId',
        packageName: '$subscription.packageName', paymentInfo: '$subscription.paymentInfo',
        user: { _id: 1, email: 1, userInfo: { fullName: 1 }, location: { country: 1 }, status: 1 },
      } },
      { $facet: {
        items: [{ $skip: (query.page - 1) * query.pageSize }, { $limit: query.pageSize }],
        metadata: [{ $count: 'total' }],
      } },
    );
    const [result] = await this.subscriptions.aggregate(pipeline);
    return pageResult(result?.items ?? [], result?.metadata[0]?.total ?? 0, query.page, query.pageSize);
  }
}

@ApiTags('Suscripciones') @ApiCookieAuth(SESSION_COOKIE) @UseGuards(AdminGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}
  @Get('active') active(@Query() query: PaginationDto) { return this.service.active(query); }
}
