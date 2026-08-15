import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

// Categorias padrão criadas automaticamente para cada novo usuário,
// já cobrindo a lista pedida para o gráfico de despesas por categoria.
export const DEFAULT_CATEGORIES = [
  { name: 'Mercado/Alimentação', color: '#16A34A', icon: 'shopping-cart' },
  { name: 'Moradia', color: '#B45309', icon: 'home' },
  { name: 'Cartão', color: '#7C3AED', icon: 'credit-card' },
  { name: 'Roupas', color: '#DB2777', icon: 'shirt' },
  { name: 'Carro', color: '#0EA5E9', icon: 'car' },
  { name: 'Lazer', color: '#F59E0B', icon: 'party-popper' },
  { name: 'Presentes', color: '#EF4444', icon: 'gift' },
  { name: 'Farmácia', color: '#14B8A6', icon: 'pill' },
  { name: 'Salão/Barbearia', color: '#8B5CF6', icon: 'scissors' },
  { name: 'Cuidados Pessoais', color: '#F472B6', icon: 'sparkles' },
  { name: 'Compras Supérfluas', color: '#F97316', icon: 'shopping-bag' },
  { name: 'Telefone', color: '#0891B2', icon: 'phone' },
  { name: 'Internet', color: '#6366F1', icon: 'wifi' },
];

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  create(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        color: dto.color ?? '#64748B',
        icon: dto.icon ?? 'tag',
        parentId: dto.parentId,
      },
    });
  }

  /**
   * Cria o conjunto de categorias padrão para um usuário que ainda não tem
   * nenhuma categoria cadastrada. Chamado no registro e pode ser usado como
   * script de "backfill" para usuários já existentes sem categorias.
   */
  async ensureDefaults(userId: string) {
    const existingCount = await this.prisma.category.count({ where: { userId } });
    if (existingCount > 0) return;

    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
    });
  }
}
