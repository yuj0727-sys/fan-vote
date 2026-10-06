import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { ArtistRanking } from '../rankings/assign-ranks.js';
import { RankingsService } from '../rankings/rankings.service.js';
import { REALTIME_EVENTS, TOP_RANKING_LIMIT } from './realtime.events.js';

// 데모용이라 소켓 인증은 구현하지 않는다.
@WebSocketGateway({
  namespace: '/rankings',
  cors: {
    // 데모용으로 전체 origin을 허용한다. 운영에서는 허용 origin 제한 필요.
    origin: '*',
  },
})
export class RankingsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RankingsGateway.name);

  @WebSocketServer()
  private readonly rankingsNamespace: Namespace;

  constructor(private readonly rankingsService: RankingsService) {}

  broadcastRankingUpdated(topRankings: ArtistRanking[]): void {
    this.rankingsNamespace.emit(REALTIME_EVENTS.rankingUpdated, topRankings);
  }

  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(
      `클라이언트 접속 id=${client.id} 현재 접속자 수=${client.nsp.sockets.size}`,
    );

    const totalRankings = await this.rankingsService.getTotalRankings();
    client.emit(
      REALTIME_EVENTS.rankingSnapshot,
      totalRankings.slice(0, TOP_RANKING_LIMIT),
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(
      `클라이언트 해제 id=${client.id} 현재 접속자 수=${client.nsp.sockets.size}`,
    );
  }
}
