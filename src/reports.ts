import { Controller, Get, Injectable, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Model, PipelineStage, Types } from 'mongoose';
import { AdminGuard, SESSION_COOKIE } from './auth';
import { pageResult, ReportQueryDto, safeRegex } from './common';
import { Report } from './database.schemas';

@Injectable()
export class ReportsService {
  constructor(@InjectModel(Report.name) private reports: Model<Report>) {}

  private match(query: ReportQueryDto) {
    const match: Record<string, unknown> = {};
    if (query.status) match.status = query.status;
    if (query.reason) match.reportReason = query.reason;
    if (query.severity) match.severity = query.severity;
    if (query.reportedUserId && Types.ObjectId.isValid(query.reportedUserId)) match.reportedUserId = new Types.ObjectId(query.reportedUserId);
    if (query.from || query.to) {
      const date: Record<string, Date> = {};
      if (query.from) date.$gte = new Date(query.from);
      if (query.to) date.$lte = new Date(query.to);
      match.createdAt = date;
    }
    return match;
  }

  private enrich(): PipelineStage[] {
    return [
      { $lookup: { from: 'users', localField: 'reporterUserId', foreignField: '_id', as: 'reporter' } },
      { $lookup: { from: 'users', localField: 'reportedUserId', foreignField: '_id', as: 'reportedUser' } },
      { $lookup: { from: 'reportReasons', localField: 'reportReason', foreignField: '_id', as: 'reason' } },
      { $set: {
        reporter: { $arrayElemAt: ['$reporter', 0] },
        reportedUser: { $arrayElemAt: ['$reportedUser', 0] },
        reason: { $arrayElemAt: ['$reason', 0] },
      } },
      { $project: {
        reporterUserId: 1, reportedUserId: 1, reportReason: 1, severity: 1, status: 1, message: 1, createdAt: 1,
        reporter: { _id: 1, email: 1, userInfo: { fullName: 1 } },
        reportedUser: { _id: 1, email: 1, userInfo: { fullName: 1 }, status: 1 },
        reason: { language: 1 },
      } },
    ];
  }

  async list(query: ReportQueryDto) {
    const match = this.match(query);
    const searchStage = query.search ? { $match: { $or: [
      { 'reporter.email': { $regex: safeRegex(query.search), $options: 'i' } },
      { 'reportedUser.email': { $regex: safeRegex(query.search), $options: 'i' } },
      { 'reportedUser.userInfo.fullName': { $regex: safeRegex(query.search), $options: 'i' } },
    ] } } : null;
    const pipeline: PipelineStage[] = [{ $match: match }, ...this.enrich()];
    if (searchStage) pipeline.push(searchStage as PipelineStage);
    pipeline.push({ $sort: { createdAt: -1 } }, { $facet: {
      items: [{ $skip: (query.page - 1) * query.pageSize }, { $limit: query.pageSize }],
      metadata: [{ $count: 'total' }],
    } });
    const [result] = await this.reports.aggregate(pipeline);
    return pageResult(result?.items ?? [], result?.metadata[0]?.total ?? 0, query.page, query.pageSize);
  }

  async byUser(query: ReportQueryDto) {
    const pipeline: PipelineStage[] = [
      { $match: this.match(query) },
      { $group: {
        _id: '$reportedUserId', total: { $sum: 1 }, averageSeverity: { $avg: '$severity' },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        underReview: { $sum: { $cond: [{ $eq: ['$status', 'under_review'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
      } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $set: { user: { $arrayElemAt: ['$user', 0] } } },
      { $project: { total: 1, averageSeverity: { $round: ['$averageSeverity', 1] }, pending: 1, underReview: 1, resolved: 1, user: { _id: 1, email: 1, userInfo: { fullName: 1 }, status: 1 } } },
      { $sort: { total: -1 } },
      { $facet: {
        items: [{ $skip: (query.page - 1) * query.pageSize }, { $limit: query.pageSize }],
        metadata: [{ $count: 'total' }],
      } },
    ];
    const [result] = await this.reports.aggregate(pipeline);
    return pageResult(result?.items ?? [], result?.metadata[0]?.total ?? 0, query.page, query.pageSize);
  }

  async detail(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Reporte no encontrado');
    const [result] = await this.reports.aggregate([{ $match: { _id: new Types.ObjectId(id) } }, ...this.enrich()]);
    if (!result) throw new NotFoundException('Reporte no encontrado');
    return result;
  }
}

@ApiTags('Reportes') @ApiCookieAuth(SESSION_COOKIE) @UseGuards(AdminGuard)
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}
  @Get() list(@Query() query: ReportQueryDto) { return this.service.list(query); }
  @Get('by-user') byUser(@Query() query: ReportQueryDto) { return this.service.byUser(query); }
  @Get(':id') detail(@Param('id') id: string) { return this.service.detail(id); }
}
