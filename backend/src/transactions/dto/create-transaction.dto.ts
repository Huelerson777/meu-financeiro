import { IsString, IsNumber, IsEnum, IsDateString, IsIn, IsOptional, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TransactionStatus } from '@prisma/client';
import { MAX_MONEY_AMOUNT } from '../../common/utils/money';

export class CreateTransactionDto {
  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  // TRANSFER fica de fora de propósito: transferência nasce em POST
  // /accounts/transfer (que cria o Transfer e move o saldo das duas contas).
  // Uma Transaction TRANSFER criada/convertida por aqui ficaria sem o vínculo
  // e não poderia mais ser editada nem excluída.
  @IsIn(['INCOME', 'EXPENSE'], { message: 'type deve ser INCOME ou EXPENSE' })
  type: 'INCOME' | 'EXPENSE';

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description: string;

  // Nunca negativo: o sentido (entra/sai) vem de `type`, e um valor negativo
  // inverteria o efeito no saldo da conta. Zero é aceito porque conta fixa
  // sem valor padrão nasce zerada até o usuário informar o valor do mês.
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  amount: number;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
