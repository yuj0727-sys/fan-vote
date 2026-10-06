import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Artist } from '../artists/artist.entity.js';
import { getTodayInSeoul } from '../common/date.util.js';
import { User } from '../users/user.entity.js';
import { CreateVoteDto } from './create-vote.dto.js';
import { Vote } from './vote.entity.js';

export type CreatedVote = {
  id: number;
  userId: number;
  artistId: number;
  votedDate: string;
};

const incrementArtistVoteCountSql = `
INSERT INTO artist_vote_counts ("artistId", "totalCount")
VALUES ($1, 1)
ON CONFLICT ("artistId") DO UPDATE
SET
  "totalCount" = artist_vote_counts."totalCount" + 1,
  "updatedAt" = now()
`;

@Injectable()
export class VotesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Artist)
    private readonly artistRepository: Repository<Artist>,
  ) {}

  async createVote(createVoteDto: CreateVoteDto): Promise<CreatedVote> {
    const user = await this.userRepository.findOne({
      where: { id: createVoteDto.userId },
    });
    if (!user) {
      throw new NotFoundException(
        `아이디가 ${createVoteDto.userId}인 유저를 찾을 수 없습니다.`,
      );
    }

    const artist = await this.artistRepository.findOne({
      where: { id: createVoteDto.artistId },
    });
    if (!artist) {
      throw new NotFoundException(
        `아이디가 ${createVoteDto.artistId}인 아티스트를 찾을 수 없습니다.`,
      );
    }

    const votedDate = getTodayInSeoul();

    // 투표 존재 여부를 먼저 조회하지 않는다. 조회와 저장 사이에 다른 요청이 끼어들 수 있다.
    let savedVote: Vote;
    try {
      savedVote = await this.dataSource.transaction(async (manager) => {
        const vote = manager.create(Vote, {
          user,
          artist,
          votedDate,
        });
        const insertedVote = await manager.save(vote);
        await manager.query(incrementArtistVoteCountSql, [artist.id]);
        return insertedVote;
      });
    } catch (error) {
      if (!this.isPostgresUniqueViolation(error)) {
        throw error;
      }
      throw new ConflictException('오늘 이미 이 아티스트에게 투표했습니다.');
    }

    return {
      id: savedVote.id,
      userId: createVoteDto.userId,
      artistId: createVoteDto.artistId,
      votedDate: savedVote.votedDate,
    };
  }

  private isPostgresUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    if ('code' in error && error.code === '23505') {
      return true;
    }

    return (
      'driverError' in error &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }
}
