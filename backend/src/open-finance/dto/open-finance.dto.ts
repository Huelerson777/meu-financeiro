import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConnectionDto {
  /** Id do item (conexão com o banco) no Meu Pluggy. */
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  itemId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;
}

export class LinkAccountDto {
  @IsString()
  pluggyAccountId: string;

  @IsString()
  accountId: string;
}
