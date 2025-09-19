import { ApolloDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { StellatePurgeInterceptor } from '../../src';
import { AppController } from './app.controller';
import { GqlModule } from './gql/gql.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env' }),
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true,
      debug: true,
    }),
    GqlModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useValue: new StellatePurgeInterceptor({
        serviceName: process.env.STELLATE_SERVICE_NAME,
        purgeToken: process.env.STELLATE_PURGE_TOKEN,
      }),
    },
  ],
})
export class AppModule {}
