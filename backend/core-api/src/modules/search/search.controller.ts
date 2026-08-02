import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser } from '@finance-crm/common';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiCookieAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global search across leads/customers by query string',
  })
  search(
    @Query() query: SearchQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.searchService.search(query.q, user.roles);
  }
}
