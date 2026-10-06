import { assignRanks, type ArtistVoteCount } from './assign-ranks.js';

describe('assignRanks', () => {
  it('득표수가 모두 다르면 1부터 차례로 순위를 매긴다', () => {
    const artistVoteCounts: ArtistVoteCount[] = [
      { artistId: 1, name: '알파', voteCount: 3 },
      { artistId: 2, name: '브라보', voteCount: 2 },
      { artistId: 3, name: '찰리', voteCount: 1 },
    ];

    expect(assignRanks(artistVoteCounts)).toEqual([
      { rank: 1, artistId: 1, name: '알파', voteCount: 3 },
      { rank: 2, artistId: 2, name: '브라보', voteCount: 2 },
      { rank: 3, artistId: 3, name: '찰리', voteCount: 1 },
    ]);
  });

  it('같은 득표수는 같은 순위이고 다음 순위는 건너뛴다', () => {
    const artistVoteCounts: ArtistVoteCount[] = [
      { artistId: 1, name: '알파', voteCount: 5 },
      { artistId: 2, name: '브라보', voteCount: 5 },
      { artistId: 3, name: '찰리', voteCount: 3 },
      { artistId: 4, name: '델타', voteCount: 1 },
      { artistId: 5, name: '에코', voteCount: 1 },
    ];

    expect(
      assignRanks(artistVoteCounts).map((ranking) => ranking.rank),
    ).toEqual([1, 1, 3, 4, 4]);
  });

  it('0표 아티스트도 순위에 포함하고 동률이면 artistId가 작은 쪽이 앞이다', () => {
    const artistVoteCounts: ArtistVoteCount[] = [
      { artistId: 4, name: '델타', voteCount: 0 },
      { artistId: 2, name: '브라보', voteCount: 2 },
      { artistId: 3, name: '찰리', voteCount: 0 },
      { artistId: 1, name: '알파', voteCount: 2 },
    ];

    expect(assignRanks(artistVoteCounts)).toEqual([
      { rank: 1, artistId: 1, name: '알파', voteCount: 2 },
      { rank: 1, artistId: 2, name: '브라보', voteCount: 2 },
      { rank: 3, artistId: 3, name: '찰리', voteCount: 0 },
      { rank: 3, artistId: 4, name: '델타', voteCount: 0 },
    ]);
  });

  it('입력 배열 순서는 바꾸지 않는다', () => {
    const artistVoteCounts: ArtistVoteCount[] = [
      { artistId: 2, name: '브라보', voteCount: 1 },
      { artistId: 1, name: '알파', voteCount: 1 },
    ];

    assignRanks(artistVoteCounts);

    expect(artistVoteCounts).toEqual([
      { artistId: 2, name: '브라보', voteCount: 1 },
      { artistId: 1, name: '알파', voteCount: 1 },
    ]);
  });
});
