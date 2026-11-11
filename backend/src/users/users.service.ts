import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  async updateProfile(userId: string, input: UpdateUserDto) {
    const { currentPassword, ...dto } = input;
    if (dto.email) {
      const existing = await this.usersRepository.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Este e-mail já está em uso');
      }
    }
    if (dto.whatsappNumber) {
      const existing = await this.usersRepository.findByWhatsappNumber(dto.whatsappNumber);
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Este número de WhatsApp já está vinculado a outra conta');
      }
    }
    // Trocar o e-mail invalida a confirmação anterior — o novo endereço
    // precisa ser verificado de novo (o app mostra o aviso e o código).
    const current = dto.email ? await this.usersRepository.findById(userId) : null;
    // Compara sem diferenciar maiúsculas: o DTO normaliza o e-mail, e uma conta
    // antiga salva como "Maria@Email.com" não pode perder a verificação só
    // por salvar o perfil sem trocar de endereço.
    const emailChanged = !!current && !!dto.email && dto.email.toLowerCase() !== current.email.toLowerCase();
    // Trocar o e-mail é o caminho pra tomar a conta (basta pedir "esqueci a
    // senha" no endereço novo): exige a senha atual, pra que uma sessão
    // roubada ou esquecida aberta não baste.
    if (emailChanged) {
      const matches = !!currentPassword && (await bcrypt.compare(currentPassword, current!.passwordHash));
      if (!matches) throw new ForbiddenException('Informe sua senha atual para trocar o e-mail');
    }
    const updated = await this.usersRepository.update(
      userId,
      emailChanged ? { ...dto, emailVerifiedAt: null } : dto,
    );
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
    await this.usersRepository.revokeAllMcpTokens(userId);
    return { message: 'Senha alterada com sucesso' };
  }

  /**
   * Exclui a conta de verdade: usuário e todos os dados dele (contas,
   * transações, cartões, metas, conexões, tokens...). É o que a tela promete
   * ("ação irreversível, todos os seus dados serão apagados") — antes a conta
   * só era desativada: os dados continuavam no banco e o e-mail ficava preso.
   */
  async deleteAccount(userId: string, password: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new ForbiddenException('Senha incorreta');

    await this.usersRepository.deleteWithAllData(userId);
    return { message: 'Conta excluída com sucesso' };
  }
}
