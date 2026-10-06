export const VOTE_CREATED_EVENT = 'vote.created';

export type VoteCreatedEvent = {
  artistId: number;
  userId: number;
  votedDate: string;
};
