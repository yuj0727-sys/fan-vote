import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { RankingsService } from '../rankings/rankings.service.js';
import { VOTE_CREATED_EVENT } from '../votes/vote-created.event.js';
import { RankingsGateway } from './rankings.gateway.js';
import { TOP_RANKING_LIMIT } from './realtime.events.js';

const DEFAULT_RANKING_BROADCAST_INTERVAL_MS = 1000;

@Injectable()
export class RankingBroadcasterService implements OnModuleDestroy {
  private readonly logger = new Logger(RankingBroadcasterService.name);
  private readonly broadcastIntervalMs: number;
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly rankingsService: RankingsService,
    private readonly rankingsGateway: RankingsGateway,
    configService: ConfigService,
  ) {
    this.broadcastIntervalMs = readBroadcastIntervalMs(configService);
  }

  @OnEvent(VOTE_CREATED_EVENT)
  handleVoteCreated(): void {
    if (this.broadcastTimer !== null) {
      return;
    }

    // 대기 중에는 타이머를 더 만들지 않는다.
    // 타이머가 끝나는 시점의 순위를 조회하므로, 그 사이 투표는 같은 전송에 포함된다.
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      void this.broadcastTopRankings();
    }, this.broadcastIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.broadcastTimer === null) {
      return;
    }

    clearTimeout(this.broadcastTimer);
    this.broadcastTimer = null;
  }

  private async broadcastTopRankings(): Promise<void> {
    try {
      const totalRankings = await this.rankingsService.getTotalRankings();
      this.rankingsGateway.broadcastRankingUpdated(
        totalRankings.slice(0, TOP_RANKING_LIMIT),
      );
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('누적 순위 방송에 실패했습니다.', errorStack);
    }
  }
}

function readBroadcastIntervalMs(configService: ConfigService): number {
  const configuredInterval = configService.get<string>(
    'RANKING_BROADCAST_INTERVAL_MS',
  );
  if (configuredInterval === undefined || configuredInterval === '') {
    return DEFAULT_RANKING_BROADCAST_INTERVAL_MS;
  }

  const intervalMs = Number(configuredInterval);
  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    return DEFAULT_RANKING_BROADCAST_INTERVAL_MS;
  }

  return intervalMs;
}
