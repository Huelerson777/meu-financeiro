import { PrismaClient, AccountType, TransactionType, TransactionStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  const passwordHash = await bcrypt.hash('123456', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@financeflow.com' },
    update: {},
    create: {
      name: 'Usuário Demo',
      email: 'demo@financeflow.com',
      passwordHash,
      settings: {
        create: {
          theme: 'system',
          language: 'pt-BR',
          currency: 'BRL',
        },
      },
    },
  });

  const checkingAccount = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Conta Corrente Principal',
      type: AccountType.CHECKING,
      initialBalance: 5000,
      currentBalance: 5000,
      color: '#2563EB',
      icon: 'landmark',
    },
  });

  const walletAccount = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Carteira',
      type: AccountType.WALLET,
      initialBalance: 200,
      currentBalance: 200,
      color: '#16A34A',
      icon: 'wallet',
    },
  });

  const salaryCategory = await prisma.category.create({
    data: {
      userId: user.id,
      name: 'Salário',
      color: '#16A34A',
      icon: 'briefcase',
    },
  });

  const foodCategory = await prisma.category.create({
    data: {
      userId: user.id,
      name: 'Alimentação',
      color: '#F97316',
      icon: 'utensils',
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: checkingAccount.id,
        categoryId: salaryCategory.id,
        type: TransactionType.INCOME,
        description: 'Salário Mensal',
        amount: 6500,
        status: TransactionStatus.PAID,
        date: new Date(),
      },
      {
        userId: user.id,
        accountId: walletAccount.id,
        categoryId: foodCategory.id,
        type: TransactionType.EXPENSE,
        description: 'Restaurante',
        amount: 85.5,
        status: TransactionStatus.PAID,
        date: new Date(),
      },
    ],
  });

  console.log('✅ Seed concluído:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
