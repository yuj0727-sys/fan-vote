import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ArtistRanking } from '../rankings/assign-ranks.js';
import type { RankingsService } from '../rankings/rankings.service.js';
import type { RankingsGateway } from './rankings.gateway.js';
import { RankingBroadcasterService } from './ranking-broadcaster.service.js';
import { TOP_RANKING_LIMIT } from './realtime.events.js';

const BROADCAST_INTERVAL_MS = 1000;

function createArtistRanking(artistId: number): ArtistRanking {
  return {
    rank: artistId,
    artistId,
    name: `artist-${artistId}`,
    voteCount: 1000 - artistId,
  };
}

describe('RankingBroadcasterService', () => {
  let getTotalRankings: ReturnType<typeof vi.fn>;
  let broadcastRankingUpdated: ReturnType<typeof vi.fn>;
  let broadcaster: RankingBroadcasterService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    getTotalRankings = vi.fn();
    broadcastRankingUpdated = vi.fn();
    broadcaster = new RankingBroadcasterService(
      { getTotalRankings } as unknown as RankingsService,
      { broadcastRankingUpdated } as unknown as RankingsGateway,
      {
        get: () => String(BROADCAST_INTERVAL_MS),
      } as unknown as ConfigService,
    );
  });

  afterEach(() => {
    broadcaster.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('간격 안에 vote.created가 100번 와도 순위 조회와 전송은 1번만 일어난다', async () => {
    const totalRankings = Array.from({ length: 12 }, (_, index) =>
      createArtistRanking(index + 1),
    );
    getTotalRankings.mockResolvedValue(totalRankings);

    for (let eventIndex = 0; eventIndex < 100; eventIndex += 1) {
      broadcaster.handleVoteCreated();
    }

    expect(getTotalRankings).not.toHaveBeenCalled();
    expect(broadcastRankingUpdated).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(BROADCAST_INTERVAL_MS);

    expect(getTotalRankings).toHaveBeenCalledTimes(1);
    expect(broadcastRankingUpdated).toHaveBeenCalledTimes(1);
    expect(broadcastRankingUpdated).toHaveBeenCalledWith(
      totalRankings.slice(0, TOP_RANKING_LIMIT),
    );
  });

  it('간격이 지난 뒤 이벤트가 오면 다시 1번 전송된다', async () => {
    const totalRankings = [createArtistRanking(1)];
    getTotalRankings.mockResolvedValue(totalRankings);

    broadcaster.handleVoteCreated();
    await vi.advanceTimersByTimeAsync(BROADCAST_INTERVAL_MS);

    broadcaster.handleVoteCreated();
    await vi.advanceTimersByTimeAsync(BROADCAST_INTERVAL_MS);

    expect(getTotalRankings).toHaveBeenCalledTimes(2);
    expect(broadcastRankingUpdated).toHaveBeenCalledTimes(2);
  });

  it('순위 조회가 실패해도 다음 이벤트에서 정상 전송된다', async () => {
    const totalRankings = [createArtistRanking(1)];
    getTotalRankings
      .mockRejectedValueOnce(new Error('순위 조회 실패'))
      .mockResolvedValueOnce(totalRankings);

    broadcaster.handleVoteCreated();
    await vi.advanceTimersByTimeAsync(BROADCAST_INTERVAL_MS);

    expect(broadcastRankingUpdated).not.toHaveBeenCalled();

    broadcaster.handleVoteCreated();
    await vi.advanceTimersByTimeAsync(BROADCAST_INTERVAL_MS);

    expect(getTotalRankings).toHaveBeenCalledTimes(2);
    expect(broadcastRankingUpdated).toHaveBeenCalledTimes(1);
    expect(broadcastRankingUpdated).toHaveBeenCalledWith(totalRankings);
  });
});
