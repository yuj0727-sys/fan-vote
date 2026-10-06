import { Module } from '@nestjs/common';
import { RankingsModule } from '../rankings/rankings.module.js';
import { RankingBroadcasterService } from './ranking-broadcaster.service.js';
import { RankingsGateway } from './rankings.gateway.js';

@Module({
  imports: [RankingsModule],
  providers: [RankingsGateway, RankingBroadcasterService],
})
export class RealtimeModule {}
