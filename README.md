# fan-vote

팬 투표 서비스의 미니 버전이다. NestJS와 PostgreSQL로 투표 API를 만들고, 중복 방지, 랭킹, 실시간 현황을 단계적으로 붙이는 포트폴리오 프로젝트다. 로그인은 구현하지 않으며, 투표 요청의 `userId`는 데모용이다.

## 기술 스택

- TypeScript, NestJS
- TypeORM, PostgreSQL 16
- Docker Compose
- class-validator

## 실행 방법

```bash
git clone https://github.com/yuj0727-sys/fan-vote.git
cd fan-vote
npm install
cp .env.example .env
docker compose up -d
npm run seed
npm run start:dev
```

서버는 `http://localhost:3000`에서 실행된다. `npm run seed`는 아티스트 5명과 유저 10명(`user1`~`user10`)을 넣으며, 이미 있으면 건너뛴다.

## API

### GET /artists

아티스트 목록을 반환한다. 응답 필드는 `id`, `name`이다.

```bash
curl http://localhost:3000/artists
```

### POST /votes

투표를 저장한다. 요청 body는 `{ "userId": number, "artistId": number }`이고, 둘 다 양의 정수여야 한다. `votedDate`는 서버 기준 오늘 날짜로 저장된다. 성공하면 201과 함께 `id`, `userId`, `artistId`, `votedDate`를 반환한다. 없는 유저나 아티스트는 404다.

```bash
curl -X POST http://localhost:3000/votes \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"artistId":1}'
```

## 진행 현황

- [x] 프로젝트 세팅 / 투표 API 기본
- [ ] 중복·동시성 처리
- [ ] 랭킹 조회 및 인덱스 최적화
- [ ] WebSocket 실시간 현황

## 설계 메모

단계별로 채울 예정.
