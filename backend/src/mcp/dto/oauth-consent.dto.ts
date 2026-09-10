import { IsString } from 'class-validator';

export class OAuthConsentDto {
  @IsString()
  clientId: string;

  @IsString()
  redirectUri: string;

  @IsString()
  codeChallenge: string;

  @IsString()
  codeChallengeMethod: string;
}
