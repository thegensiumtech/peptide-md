import { PrismaClient } from '@prisma/client';

/**
 * One Prisma instance per process.
 *
 * Next.js and tsx both hot-reload modules in development, which would open a
 * new connection pool on every reload and exhaust Postgres within a few edits.
 * Caching on globalThis survives the reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
export { Prisma } from '@prisma/client';
