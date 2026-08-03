import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';

describe('AccountsService', () => {
  let service: AccountsService;
  let repository: jest.Mocked<AccountsRepository>;

  const userId = 'user-1';
  const account = {
    id: 'acc-1',
    userId,
    name: 'Conta Teste',
    currentBalance: 1000,
  } as any;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: AccountsRepository,
          useValue: {
            create: jest.fn(),
            findManyPaginated: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            archive: jest.fn(),
            createTransfer: jest.fn(),
            getTotalBalance: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AccountsService);
    repository = moduleRef.get(AccountsRepository);
  });

  it('deve criar uma conta', async () => {
    repository.create.mockResolvedValue(account);
    const result = await service.create(userId, { name: 'Conta Teste', type: 'CHECKING' } as any);
    expect(result).toEqual(account);
    expect(repository.create).toHaveBeenCalledWith(userId, expect.any(Object));
  });

  it('deve lançar NotFoundException ao buscar conta inexistente', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findOne('inexistente', userId)).rejects.toThrow(NotFoundException);
  });

  it('deve impedir transferência com saldo insuficiente', async () => {
    repository.findById.mockResolvedValue({ ...account, currentBalance: 50 });
    await expect(
      service.transfer(userId, { fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 500 }),
    ).rejects.toThrow('Saldo insuficiente para realizar a transferência');
  });

  it('deve impedir acesso a conta de outro usuário', async () => {
    repository.findById.mockResolvedValue({ ...account, userId: 'outro-usuario' });
    await expect(service.update('acc-1', userId, { name: 'Hack' } as any)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
