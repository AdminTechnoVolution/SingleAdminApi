import { normalizedCountryExpr, normalizedGenderExpr, pageResult, safeRegex } from './common';
import { PaginationDto } from './common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('common helpers', () => {
  it('escapes unsafe regex input', () => expect(safeRegex('a+b?')).toBe('a\\+b\\?'));
  it('creates a stable paginated response', () => {
    expect(pageResult(['x'], 21, 2, 10)).toEqual({ items: ['x'], page: 2, pageSize: 10, total: 21, totalPages: 3 });
  });
  it('defines Sin identificar for missing countries', () => {
    expect(JSON.stringify(normalizedCountryExpr)).toContain('Sin identificar');
    expect(JSON.stringify(normalizedCountryExpr)).toContain('$location.country');
  });
  it('shares the complete gender classification used by country totals', () => {
    const expression = JSON.stringify(normalizedGenderExpr);
    expect(expression).toContain('"M"');
    expect(expression).toContain('"F"');
    expect(expression).toContain('"male"');
    expect(expression).toContain('"female"');
    expect(expression).toContain('"other"');
    expect(expression).toContain('"unknown"');
  });
  it('uses pagination defaults when query parameters are missing or empty', async () => {
    for (const query of [{}, { page: '', pageSize: '' }]) {
      const dto = plainToInstance(PaginationDto, query);
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.pageSize).toBe(20);
    }
  });
  it('still rejects genuinely invalid pagination values', async () => {
    const dto = plainToInstance(PaginationDto, { page: '0', pageSize: '101' });
    expect(await validate(dto)).toHaveLength(2);
  });
});
