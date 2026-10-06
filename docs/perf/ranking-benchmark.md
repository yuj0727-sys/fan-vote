# 랭킹 쿼리 벤치마크

## 측정 환경

| 항목 | 값 |
| --- | --- |
| PostgreSQL | 16 |
| 실행 환경 | Docker |
| 머신 | Apple M5, 10코어(성능 4, 효율 6), 메모리 24GB |
| 데이터 규모 | 유저 10,010명, 아티스트 25명, 투표 1,182,978건 |

## 측정 방법

`perf/measure.sh`는 1회차를 콜드로 따로 표시하고, 나머지 회차의 Execution Time 중앙값을 출력한다. 표의 중앙값에는 그 중앙값을 적고, 실행 계획에는 마지막 회차에서 보인 핵심 Scan 노드를 적는다.

```bash
./perf/measure.sh perf/ranking-daily.sql
./perf/measure.sh perf/ranking-total.sql
```

## 결과

| 시나리오 | 인덱스 | 실행 계획(핵심 노드) | 중앙값(ms) |
| --- | --- | --- | --- |
| 일별 랭킹 | 없음 | | |
| 일별 랭킹 | idx_votes_date_artist | | |
| 누적 랭킹(집계) | 없음 | | |
| 누적 랭킹(집계) | idx_votes_date_artist | | |
| 누적 랭킹(카운터 테이블) | | | |
