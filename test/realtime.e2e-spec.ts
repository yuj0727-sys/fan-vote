import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Artist } from '../src/artists/artist.entity.js';
import type { ArtistRanking } from '../src/rankings/assign-ranks.js';
import {
  REALTIME_EVENTS,
  TOP_RANKING_LIMIT,
} from '../src/realtime/realtime.events.js';
import { User } from '../src/users/user.entity.js';

const RANKING_BROADCAST_INTERVAL_MS = 100;
const SOCKET_EVENT_TIMEOUT_MS = 3000;
const NO_RANKING_UPDATE_WAIT_MS = 500;
const CONCURRENT_VOTER_COUNT = 20;

describe('Realtime (e2e)', () => {
  const originalBroadcastInterval = process.env.RANKING_BROADCAST_INTERVAL_MS;

  let app: INestApplication<App> | undefined;
  let dataSource: DataSource;
  let serverUrl: string;
  const connectedSockets: Socket[] = [];
  const pendingCleanups: Array<() => void> = [];

  beforeEach(async () => {
    process.env.RANKING_BROADCAST_INTERVAL_MS = String(
      RANKING_BROADCAST_INTERVAL_MS,
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );
    await app.listen(0);

    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('테스트 서버 주소를 확인할 수 없습니다.');
    }
    const host =
      address.address === '::' || address.address === '0.0.0.0'
        ? '127.0.0.1'
        : address.address;
    serverUrl = `http://${host}:${address.port}`;

    dataSource = app.get(DataSource);
    const currentDatabaseRows: Array<{ current_database: string }> =
      await dataSource.query('SELECT current_database()');
    const connectedDatabaseName = currentDatabaseRows[0]?.current_database;
    if (connectedDatabaseName !== 'fan_vote_test') {
      throw new Error(
        `테스트 DB가 아닙니다. 현재 연결: ${connectedDatabaseName}`,
      );
    }

    await dataSource.query(
      'TRUNCATE TABLE "vote", artist_vote_counts RESTART IDENTITY',
    );
  });

  afterEach(async () => {
    for (const cleanup of pendingCleanups) {
      cleanup();
    }
    pendingCleanups.length = 0;

    for (const socket of connectedSockets) {
      socket.disconnect();
    }
    connectedSockets.length = 0;

    await app?.close();
    app = undefined;
  });

  afterAll(() => {
    if (originalBroadcastInterval === undefined) {
      delete process.env.RANKING_BROADCAST_INTERVAL_MS;
      return;
    }
    process.env.RANKING_BROADCAST_INTERVAL_MS = originalBroadcastInterval;
  });

  it('접속하면 ranking:snapshot을 받는다', async () => {
    const { snapshot } = await connectRankingSocket();

    const response = await request(app!.getHttpServer())
      .get('/rankings/total')
      .expect(200);

    expect(snapshot).toEqual(
      (response.body as ArtistRanking[]).slice(0, TOP_RANKING_LIMIT),
    );
  });

  it('클라이언트 2명이 접속한 상태에서 투표가 성공하면 둘 다 ranking:updated를 받고 해당 아티스트 득표가 증가한다', async () => {
    const user = await createUser('실시간-성공');
    const artist = await createArtist('실시간-성공');
    const firstClient = await connectRankingSocket();
    const secondClient = await connectRankingSocket();
    const previousVoteCount = voteCountOf(firstClient.snapshot, artist.id);

    const firstUpdatePromise = waitForSocketEvent<ArtistRanking[]>(
      firstClient.socket,
      REALTIME_EVENTS.rankingUpdated,
      SOCKET_EVENT_TIMEOUT_MS,
    );
    const secondUpdatePromise = waitForSocketEvent<ArtistRanking[]>(
      secondClient.socket,
      REALTIME_EVENTS.rankingUpdated,
      SOCKET_EVENT_TIMEOUT_MS,
    );

    await request(app!.getHttpServer())
      .post('/votes')
      .send({ userId: user.id, artistId: artist.id })
      .expect(201);

    const [firstUpdate, secondUpdate] = await Promise.all([
      firstUpdatePromise,
      secondUpdatePromise,
    ]);

    expect(secondUpdate).toEqual(firstUpdate);
    expect(voteCountOf(firstUpdate, artist.id)).toBe(previousVoteCount + 1);
  });

  it('중복 투표로 409를 받으면 ranking:updated는 오지 않는다', async () => {
    const user = await createUser('실시간-중복');
    const artist = await createArtist('실시간-중복');
    const { socket } = await connectRankingSocket();

    const firstUpdatePromise = waitForSocketEvent<ArtistRanking[]>(
      socket,
      REALTIME_EVENTS.rankingUpdated,
      SOCKET_EVENT_TIMEOUT_MS,
    );
    await request(app!.getHttpServer())
      .post('/votes')
      .send({ userId: user.id, artistId: artist.id })
      .expect(201);
    await firstUpdatePromise;

    // 성공한 첫 투표의 방송이 끝난 뒤 409를 보낸다. 저장 실패는 이벤트를 발행하지 않는다.
    await expectNoRankingUpdateWhile(socket, async () => {
      await request(app!.getHttpServer())
        .post('/votes')
        .send({ userId: user.id, artistId: artist.id })
        .expect(409);
    });
  });

  it('서로 다른 유저 20명이 동시에 투표하면 ranking:updated는 1~3회이고 마지막 순위 득표 합계는 20이다', async () => {
    const artist = await createArtist('실시간-동시');
    const users = await Promise.all(
      Array.from({ length: CONCURRENT_VOTER_COUNT }, (_, index) =>
        createUser(`실시간-동시-${index}`),
      ),
    );
    const { socket } = await connectRankingSocket();

    const updatesPromise = waitForSocketEvents<ArtistRanking[]>(
      socket,
      REALTIME_EVENTS.rankingUpdated,
      SOCKET_EVENT_TIMEOUT_MS,
      (events) => sumVoteCount(events.at(-1) ?? []) === CONCURRENT_VOTER_COUNT,
      NO_RANKING_UPDATE_WAIT_MS,
    );

    const responses = await Promise.all(
      users.map((user) =>
        request(app!.getHttpServer())
          .post('/votes')
          .send({ userId: user.id, artistId: artist.id }),
      ),
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);

    const updates = await updatesPromise;
    const latestRankings = updates.at(-1) ?? [];

    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates.length).toBeLessThanOrEqual(3);
    expect(sumVoteCount(latestRankings)).toBe(CONCURRENT_VOTER_COUNT);
  }, 15000);

  async function connectRankingSocket(): Promise<{
    socket: Socket;
    snapshot: ArtistRanking[];
  }> {
    const socket = io(`${serverUrl}/rankings`, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: false,
      reconnection: false,
    });
    connectedSockets.push(socket);

    const snapshotPromise = waitForSocketEvent<ArtistRanking[]>(
      socket,
      REALTIME_EVENTS.rankingSnapshot,
      SOCKET_EVENT_TIMEOUT_MS,
    );
    socket.connect();

    return {
      socket,
      snapshot: await snapshotPromise,
    };
  }

  function waitForSocketEvent<T>(
    socket: Socket,
    eventName: string,
    timeoutMs: number,
  ): Promise<T> {
    return waitForSocketEvents<T>(
      socket,
      eventName,
      timeoutMs,
      (events) => events.length >= 1,
    ).then((events) => {
      const event = events[0];
      if (event === undefined) {
        throw new Error(`'${eventName}' 이벤트 payload가 없습니다.`);
      }
      return event;
    });
  }

  function waitForSocketEvents<T>(
    socket: Socket,
    eventName: string,
    timeoutMs: number,
    isSatisfied: (events: T[]) => boolean,
    settleMs = 0,
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const events: T[] = [];
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let settleTimer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
        if (settleTimer !== undefined) {
          clearTimeout(settleTimer);
        }
        socket.off(eventName, onEvent);
        socket.off('connect_error', onConnectError);
      };
      pendingCleanups.push(cleanup);

      const finish = (result: T[]) => {
        cleanup();
        resolve(result);
      };

      const onEvent = (payload: T) => {
        events.push(payload);
        if (settled || !isSatisfied(events)) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (settleMs === 0) {
          finish([...events]);
          return;
        }
        settleTimer = setTimeout(() => {
          finish([...events]);
        }, settleMs);
      };

      const onConnectError = (error: Error) => {
        cleanup();
        reject(error);
      };

      timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `'${eventName}' 조건이 ${timeoutMs}ms 안에 충족되지 않았습니다. 수신 ${events.length}건`,
          ),
        );
      }, timeoutMs);

      socket.on(eventName, onEvent);
      socket.on('connect_error', onConnectError);
    });
  }

  function waitForNoSocketEvent(
    socket: Socket,
    eventName: string,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
        socket.off(eventName, onEvent);
      };
      pendingCleanups.push(cleanup);

      const onEvent = () => {
        cleanup();
        reject(
          new Error(
            `'${eventName}' 이벤트가 ${timeoutMs}ms 안에 도착했습니다.`,
          ),
        );
      };

      timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);

      socket.on(eventName, onEvent);
    });
  }

  async function expectNoRankingUpdateWhile(
    socket: Socket,
    action: () => Promise<unknown>,
  ): Promise<void> {
    let receivedCount = 0;
    const onUpdated = () => {
      receivedCount += 1;
    };
    socket.on(REALTIME_EVENTS.rankingUpdated, onUpdated);
    const removeListener = () => {
      socket.off(REALTIME_EVENTS.rankingUpdated, onUpdated);
    };
    pendingCleanups.push(removeListener);

    await action();
    await waitForNoSocketEvent(
      socket,
      REALTIME_EVENTS.rankingUpdated,
      NO_RANKING_UPDATE_WAIT_MS,
    );
    removeListener();
    expect(receivedCount).toBe(0);
  }

  async function createUser(nicknamePrefix: string): Promise<User> {
    const userRepository = dataSource.getRepository(User);
    return userRepository.save(
      userRepository.create({ nickname: `${nicknamePrefix}-${randomUUID()}` }),
    );
  }

  async function createArtist(namePrefix: string): Promise<Artist> {
    const artistRepository = dataSource.getRepository(Artist);
    return artistRepository.save(
      artistRepository.create({ name: `${namePrefix}-${randomUUID()}` }),
    );
  }
});

function voteCountOf(rankings: ArtistRanking[], artistId: number): number {
  return (
    rankings.find((ranking) => ranking.artistId === artistId)?.voteCount ?? 0
  );
}

function sumVoteCount(rankings: ArtistRanking[]): number {
  return rankings.reduce((total, ranking) => total + ranking.voteCount, 0);
}
