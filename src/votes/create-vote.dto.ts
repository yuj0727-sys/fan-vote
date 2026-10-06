import { IsInt, IsPositive } from 'class-validator';

export class CreateVoteDto {
  // 이 프로젝트는 인증(로그인)을 구현하지 않는다. userId를 body로 받는 것은 데모용이다.
  @IsInt({ message: 'userId는 정수여야 합니다.' })
  @IsPositive({ message: 'userId는 양의 정수여야 합니다.' })
  userId: number;

  @IsInt({ message: 'artistId는 정수여야 합니다.' })
  @IsPositive({ message: 'artistId는 양의 정수여야 합니다.' })
  artistId: number;
}
