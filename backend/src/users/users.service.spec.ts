import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const userId = 'u1';

  async function build(overrides: Record<string, unknown> = {}) {
    const user = {
      id: userId,
      name: 'Maria',
      email: 'Maria@X.com', // conta antiga, e-mail salvo com maiúscula
      passwordHash: await bcrypt.hash('senha-atual', 4),
      emailVerifiedAt: new Date(),
      ...overrides,
    };
    const repository: any = {
      findById: jest.fn().mockResolvedValue(user),
      findByEmail: jest.fn().mockResolvedValue(user),
      findByWhatsappNumber: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation((_id: string, data: object) => Promise.resolve({ ...user, ...data })),
      deleteWithAllData: jest.fn().mockResolvedValue([]),
    };
    return { service: new UsersService(repository), repository };
  }

  describe('updateProfile', () => {
    it('trocar o e-mail sem a senha atual é recusado', async () => {
      const { service, repository } = await build();
      repository.findByEmail.mockResolvedValue(null);

      await expect(service.updateProfile(userId, { email: 'novo@x.com' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.updateProfile(userId, { email: 'novo@x.com', currentPassword: 'errada' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('trocar o e-mail com a senha certa passa, zera a verificação e não grava a senha', async () => {
      const { service, repository } = await build();
      repository.findByEmail.mockResolvedValue(null);

      const result = await service.updateProfile(userId, { email: 'novo@x.com', currentPassword: 'senha-atual' });

      expect(repository.update).toHaveBeenCalledWith(userId, { email: 'novo@x.com', emailVerifiedAt: null });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('salvar o perfil com o mesmo e-mail (só mudando maiúsculas) não pede senha nem zera a verificação', async () => {
      const { service, repository } = await build();

      await service.updateProfile(userId, { name: 'Maria Silva', email: 'maria@x.com' });

      expect(repository.update).toHaveBeenCalledWith(userId, { name: 'Maria Silva', email: 'maria@x.com' });
    });
  });

  describe('deleteAccount', () => {
    it('senha errada não apaga nada', async () => {
      const { service, repository } = await build();
      await expect(service.deleteAccount(userId, 'errada')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.deleteWithAllData).not.toHaveBeenCalled();
    });

    it('senha certa apaga a conta com todos os dados', async () => {
      const { service, repository } = await build();
      await expect(service.deleteAccount(userId, 'senha-atual')).resolves.toEqual({ message: 'Conta excluída com sucesso' });
      expect(repository.deleteWithAllData).toHaveBeenCalledWith(userId);
    });
  });
});
