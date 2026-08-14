import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    if (dto.email) {
      const existing = await this.usersRepository.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Este e-mail já está em uso');
      }
    }
    const updated = await this.usersRepository.update(userId, dto);
    const { passwordHash, ...safeUser } = updated;
    return safeUser;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) throw new BadRequestException('Senha atual incorreta');

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepository.updatePassword(userId, newHash);
    await this.usersRepository.revokeAllRefreshTokens(userId);
    return { message: 'Senha alterada com sucesso' };
  }

  async deleteAccount(userId: string) {
    await this.usersRepository.softDelete(userId);
    await this.usersRepository.revokeAllRefreshTokens(userId);
    return { message: 'Conta excluída com sucesso' };
  }
}
