import { DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StellatePurgeService } from './stellate-purge.service';
import { StellatePurgeInterceptor } from './stellate-purge.interceptor';
import { STELLATE_OPTIONS, StellateModuleOptions } from './stellate.tokens';

export interface StellateModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<StellateModuleOptions> | StellateModuleOptions;
  inject?: any[];
  global?: boolean;
}

@Module({})
export class StellateModule {
  static forRoot(options: StellateModuleOptions & { global?: boolean }): DynamicModule {
    return {
      module: StellateModule,
      global: options.global ?? true,
      providers: [
        StellatePurgeService,
        { provide: STELLATE_OPTIONS, useValue: options },
        { provide: APP_INTERCEPTOR, useClass: StellatePurgeInterceptor },
      ],
      exports: [StellatePurgeService],
    };
  }

  static forRootAsync(options: StellateModuleAsyncOptions): DynamicModule {
    return {
      module: StellateModule,
      global: options.global ?? true,
      providers: [
        StellatePurgeService,
        {
          provide: STELLATE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        { provide: APP_INTERCEPTOR, useClass: StellatePurgeInterceptor },
      ],
      exports: [StellatePurgeService],
    };
  }
}
