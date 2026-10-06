import { Module } from '@nestjs/common';
import { RankingsModule } from '../rankings/rankings.module.js';
import { RankingsGateway } from './rankings.gateway.js';

@Module({
  imports: [RankingsModule],
  providers: [RankingsGateway],
})
export class RealtimeModule {}
