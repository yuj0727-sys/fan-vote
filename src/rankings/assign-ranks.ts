export type ArtistVoteCount = {
  artistId: number;
  name: string;
  voteCount: number;
};

export type ArtistRanking = {
  rank: number;
  artistId: number;
  name: string;
  voteCount: number;
};

export function assignRanks(
  artistVoteCounts: ArtistVoteCount[],
): ArtistRanking[] {
  const sortedArtistVoteCounts = [...artistVoteCounts].sort(
    (leftArtist, rightArtist) =>
      rightArtist.voteCount - leftArtist.voteCount ||
      leftArtist.artistId - rightArtist.artistId,
  );

  let currentRank = 0;
  let previousVoteCount: number | undefined;

  return sortedArtistVoteCounts.map((artistVoteCount, index) => {
    if (artistVoteCount.voteCount !== previousVoteCount) {
      currentRank = index + 1;
      previousVoteCount = artistVoteCount.voteCount;
    }

    return {
      rank: currentRank,
      artistId: artistVoteCount.artistId,
      name: artistVoteCount.name,
      voteCount: artistVoteCount.voteCount,
    };
  });
}
