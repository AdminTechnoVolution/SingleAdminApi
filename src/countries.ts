import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard, SESSION_COOKIE } from './auth';
import { CountryQueryDto, UserQueryDto } from './common';
import { UsersService } from './users';

@ApiTags('Países') @ApiCookieAuth(SESSION_COOKIE) @UseGuards(AdminGuard)
@Controller('countries')
export class CountriesController {
  constructor(private users: UsersService) {}
  @Get() list(@Query() query: CountryQueryDto) { return this.users.countries(query); }
  @Get(':country/users')
  usersByCountry(@Param('country') country: string, @Query() query: UserQueryDto) {
    query.country = decodeURIComponent(country);
    return this.users.list(query);
  }
}
