import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import * as request from 'supertest';
import axios from 'axios';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import { StellatePurgeInterceptor } from '../src/stellate-purge.interceptor';
import { GqlResolver } from './fixtures/gql.resolver';

jest.mock('axios');
const axiosPost = axios.post as jest.Mock;

// keep test logs quiet
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

describe('GqlResolver + StellatePurgeInterceptor (GraphQL module)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true, // code-first schema
        }),
      ],
      providers: [
        GqlResolver,
        // Register interceptor the "Nest way"
        {
          provide: APP_INTERCEPTOR,
          useValue: new StellatePurgeInterceptor(
            { serviceName: 'my-stellate-service', purgeToken: 'secret' },
            new Reflector()
          ),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  it('triggers _purgeQuery from resolver metadata and returns data', async () => {
    axiosPost.mockResolvedValue({ data: {} });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ getHello }' })
      .expect(200);

    expect(res.body.data.getHello).toBe('Hello');
    expect(axiosPost).toHaveBeenCalledTimes(1);

    const [url, body, config] = axiosPost.mock.calls[0];
    expect(url).toContain('my-stellate-service');
    expect(config.headers['stellate-token']).toBe('secret');
    expect(body.query).toContain('_purgeQuery');
    expect(body.query).toContain('allPosts'); // came from @StellatePurgeQuery(['allPosts'])
  });

  it('still returns data if Stellate responds with errors', async () => {
    axiosPost.mockResolvedValue({ data: { errors: [{ message: 'boom' }] } });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ getHello }' })
      .expect(200);

    expect(res.body.data.getHello).toBe('Hello');
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  afterAll(async () => app.close());
});
