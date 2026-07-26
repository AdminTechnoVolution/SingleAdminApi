import { Controller, Get, Injectable, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { AdminGuard, SESSION_COOKIE } from './auth';
import { activityMatch, activityStages } from './activity';
import { normalizedCountryExpr, normalizedGenderExpr, pageResult, safeRegex, UserQueryDto } from './common';
import { User, UserDocument } from './database.schemas';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private users: Model<UserDocument>) {}

  private filter(query: UserQueryDto): FilterQuery<UserDocument> {
    const filter: FilterQuery<UserDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.country) {
      filter.$and = [...(filter.$and ?? []), query.country === 'Sin identificar'
        ? { $or: [{ 'location.country': { $exists: false } }, { 'location.country': null }, { 'location.country': { $regex: '^\\s*$' } }] }
        : { 'location.country': { $regex: `^\\s*${safeRegex(query.country)}\\s*$`, $options: 'i' } }];
    }
    if (query.search) {
      const regex = new RegExp(safeRegex(query.search), 'i');
      filter.$or = [{ email: regex }, { 'userInfo.fullName': regex }];
    }
    if (query.from || query.to) {
      filter.created_at = {};
      if (query.from) filter.created_at.$gte = new Date(query.from);
      if (query.to) filter.created_at.$lte = new Date(query.to);
    }
    return filter;
  }

  async list(query: UserQueryDto) {
    const filter = this.filter(query);
    const activityFilter = activityMatch(query.activity);
    const sortField = query.sortBy === 'lastInteraction' ? 'lastInteractionAt' : 'created_at';
    const sortDirection = query.order === 'asc' ? 1 : -1;
    const safeProjection: PipelineStage = { $project: {
      password: 0, auth: 0, preferences: 0, profileConfig: 0,
      musicPreferences: 0, lifestyle: 0,
    } };
    if (!activityFilter && query.sortBy === 'createdAt') {
      const paginatedItems = [
        { $skip: (query.page - 1) * query.pageSize },
        { $limit: query.pageSize },
        ...activityStages(),
        safeProjection,
      ] as PipelineStage.FacetPipelineStage[];
      const [result] = await this.users.aggregate([
        { $match: filter },
        { $sort: { created_at: sortDirection, _id: 1 } },
        { $facet: {
          items: paginatedItems,
          metadata: [{ $count: 'total' }],
        } },
      ]);
      return pageResult(result?.items ?? [], result?.metadata[0]?.total ?? 0, query.page, query.pageSize);
    }

    const pipeline: PipelineStage[] = [{ $match: filter }, ...activityStages()];
    if (activityFilter) pipeline.push({ $match: activityFilter });
    pipeline.push(
      { $sort: { [sortField]: sortDirection, _id: 1 } },
      safeProjection,
      { $facet: {
        items: [{ $skip: (query.page - 1) * query.pageSize }, { $limit: query.pageSize }],
        metadata: [{ $count: 'total' }],
      } },
    );
    const [result] = await this.users.aggregate(pipeline);
    return pageResult(result?.items ?? [], result?.metadata[0]?.total ?? 0, query.page, query.pageSize);
  }

  async detail(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Usuario no encontrado');
    const [user] = await this.users.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      ...activityStages(),
      { $project: {
        password: 0, 'auth.socialId': 0, preferences: 0, profileConfig: 0,
        musicPreferences: 0, lifestyle: 0,
      } },
    ]);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async countries(query: { page: number; pageSize: number; sortBy: 'count' | 'name'; order: 'asc' | 'desc'; search?: string }) {
    const match = query.search
      ? { 'location.country': { $regex: safeRegex(query.search), $options: 'i' } }
      : {};
    const base = [
      { $match: match },
      { $project: { country: normalizedCountryExpr, gender: normalizedGenderExpr } },
      { $group: {
        _id: '$country',
        count: { $sum: 1 },
        male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
        female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
        other: { $sum: { $cond: [{ $in: ['$gender', ['other', 'unknown']] }, 1, 0] } },
      } },
    ];
    const [rows, totalUsers] = await Promise.all([
      this.users.aggregate([
        ...base,
        { $facet: {
          items: [
            { $sort: query.sortBy === 'name' ? { _id: query.order === 'asc' ? 1 : -1 } : { count: query.order === 'asc' ? 1 : -1, _id: 1 } },
            { $skip: (query.page - 1) * query.pageSize }, { $limit: query.pageSize },
          ],
          metadata: [{ $count: 'total' }],
        } },
      ]),
      this.users.countDocuments(match),
    ]);
    const items = (rows[0]?.items ?? []).map((row: {
      _id: string; count: number; male: number; female: number; other: number;
    }) => ({
      country: row._id,
      count: row.count,
      percentage: totalUsers ? Number(((row.count / totalUsers) * 100).toFixed(2)) : 0,
      genderCounts: {
        male: row.male,
        female: row.female,
        other: row.other,
      },
    }));
    return pageResult(items, rows[0]?.metadata[0]?.total ?? 0, query.page, query.pageSize);
  }
}

@ApiTags('Usuarios') @ApiCookieAuth(SESSION_COOKIE) @UseGuards(AdminGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}
  @Get() list(@Query() query: UserQueryDto) { return this.service.list(query); }
  @Get(':id') detail(@Param('id') id: string) { return this.service.detail(id); }
}
