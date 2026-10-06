import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Artist } from '../artists/artist.entity.js';

@Entity('artist_vote_counts')
export class ArtistVoteCount {
  @PrimaryColumn()
  artistId: number;

  @ManyToOne(() => Artist, { nullable: false })
  @JoinColumn({ name: 'artistId' })
  artist: Artist;

  @Column({ type: 'bigint', default: 0 })
  totalCount: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
