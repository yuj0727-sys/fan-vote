import { Controller, Get, Query } from '@nestjs/common';
import type { ArtistRanking } from './assign-ranks.js';
import { GetDailyRankingQueryDto } from './get-daily-ranking-query.dto.js';
import { RankingsService } from './rankings.service.js';

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get('total')
  getTotalRankings(): Promise<ArtistRanking[]> {
    return this.rankingsService.getTotalRankings();
  }

  @Get()
  getDailyRankings(
    @Query() query: GetDailyRankingQueryDto,
  ): Promise<ArtistRanking[]> {
    return this.rankingsService.getDailyRankings(query.date);
  }
}
