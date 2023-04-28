import { SetMetadata } from "@nestjs/common";

export const StellatePurgeType = (type: string, idReference?: string) =>
  SetMetadata("stellate-purge-type", { type, idReference });
