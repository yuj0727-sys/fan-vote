import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from 'typeorm';
import { Artist } from '../artists/artist.entity.js';
import { User } from '../users/user.entity.js';

@Entity()
@Unique('UQ_vote_userId_artistId_votedDate', ['user', 'artist', 'votedDate'])
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
