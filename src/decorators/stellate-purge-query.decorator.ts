import { SetMetadata } from '@nestjs/common';

export const StellatePurgeQuery = (queries: string[]) =>
  SetMetadata('stellate-purge-queries', queries);
