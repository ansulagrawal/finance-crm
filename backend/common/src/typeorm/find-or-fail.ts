import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

export async function findOrFail<T extends { id: number }>(
  repository: Repository<T>,
  id: number,
  label: string,
): Promise<T> {
  const entity = await repository.findOneBy({ id } as never);
  if (!entity) {
    throw new NotFoundException(`${label} ${id} not found`);
  }
  return entity;
}
