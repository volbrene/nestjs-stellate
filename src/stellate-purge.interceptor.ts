import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StellatePurgeService } from './stellate-purge.service';

@Injectable()
export class StellatePurgeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(StellatePurgeInterceptor.name);

  constructor(
    private readonly stellatePurgeService: StellatePurgeService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.stellatePurgeService.isEnabled) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (data) => {
        const stellateQueries = this.reflector.get<string[]>(
          'stellate-purge-queries',
          context.getHandler()
        );

        const stellateType = this.reflector.get<{
          type: string;
          idReference: string | number;
        }>('stellate-purge-type', context.getHandler());

        if (stellateQueries) {
          await this.stellatePurgeService.purgeQueries(stellateQueries);
        }

        if (stellateType?.type) {
          await this.stellatePurgeService.purgeType(
            stellateType.type,
            stellateType.idReference,
            data
          );
        }

        return data;
      })
    );
  }
}
