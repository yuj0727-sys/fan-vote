import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from 'typeorm';
import { Artist } from '../artists/artist.entity.js';
import { User } from '../users/user.entity.js';

@Entity()
@Unique('UQ_vote_userId_artistId_votedDate', ['user', 'artist', 'votedDate'])
// WHERE 컬럼(votedDate)을 앞에, GROUP BY 컬럼(artistId)을 뒤에 두어 인덱스만으로 집계한다.
@Index('idx_votes_date_artist', ['votedDate', 'artist'])
export class Vote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @RelationId((vote: Vote) => vote.user)
  userId: number;

  @ManyToOne(() => Artist, { nullable: false })
  artist: Artist;

  @RelationId((vote: Vote) => vote.artist)
  artistId: number;

  @Column({ type: 'date' })
  votedDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
