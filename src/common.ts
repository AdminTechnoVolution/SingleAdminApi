import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const numberOrDefault = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === '') return fallback;
  return Number(value);
};

export class PaginationDto {
  @Transform(({ value }) => numberOrDefault(value, 1))
  @IsInt() @Min(1)
  page = 1;

  @Transform(({ value }) => numberOrDefault(value, 20))
  @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsOptional() @IsString() search?: string;
}

export class UserQueryDto extends PaginationDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Transform(({ value }) => value || undefined) @IsIn(['7d', '30d', '90d', 'inactive']) activity?: '7d' | '30d' | '90d' | 'inactive';
  @IsOptional() @IsIn(['createdAt', 'lastInteraction']) sortBy: 'createdAt' | 'lastInteraction' = 'createdAt';
  @IsOptional() @Transform(({ value }) => String(value).toLowerCase()) @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class CountryQueryDto extends PaginationDto {
  @IsOptional() @IsIn(['count', 'name']) sortBy: 'count' | 'name' = 'count';
  @IsOptional() @Transform(({ value }) => String(value).toLowerCase()) @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class ReportQueryDto extends PaginationDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(10) severity?: number;
  @IsOptional() @IsString() reportedUserId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export const pageResult = <T>(items: T[], total: number, page: number, pageSize: number) => ({
  items, page, pageSize, total, totalPages: Math.ceil(total / pageSize),
});

export const safeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normalizedCountryExpr = {
  $let: {
    vars: { value: { $trim: { input: { $ifNull: ['$location.country', ''] } } } },
    in: {
      $cond: [
        { $eq: ['$$value', ''] },
        'Sin identificar',
        { $concat: [
          { $toUpper: { $substrCP: ['$$value', 0, 1] } },
          { $toLower: { $substrCP: ['$$value', 1, { $strLenCP: '$$value' }] } },
        ] },
      ],
    },
  },
};

export const normalizedGenderExpr = {
  $switch: {
    branches: [
      { case: { $eq: ['$userInfo.gender', 'M'] }, then: 'male' },
      { case: { $eq: ['$userInfo.gender', 'F'] }, then: 'female' },
      { case: { $eq: [{ $ifNull: ['$userInfo.gender', ''] }, ''] }, then: 'unknown' },
    ],
    default: 'other',
  },
};
