import 'reflect-metadata';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GraphQLModule, Resolver, Query, Mutation, Args, ObjectType, Field } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import * as request from 'supertest';
import axios from 'axios';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { StellatePurgeInterceptor } from '../src/stellate-purge.interceptor';
import { StellatePurgeQuery } from '../src/decorators/stellate-purge-query.decorator';
import { StellatePurgeType } from '../src/decorators/stellate-purge-type.decorator';

jest.mock('axios');
const axiosPost = axios.post as jest.Mock;

// Silence logger output but keep calls observable
const dbgSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
const errSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

@ObjectType()
class PostPayload {
  // id is optional/nullable so we can test "no id" case
  @Field(() => String, { nullable: true })
  id?: string;
  @Field(() => String, { nullable: true })
  ok?: string;
}

@Resolver()
class E2eResolver {
  // Mutations decorated with StellatePurgeQuery should trigger query cache purge
  @Mutation(() => String)
  @StellatePurgeQuery(['allPosts'])
  upvotePost(@Args('postId', { type: () => String }) postId: string): string {
    return `upvoted:${postId}`;
  }

  // Mutations decorated with StellatePurgeType should trigger type purge
  // The interceptor will use the `id` field from the returned object
  @Mutation(() => PostPayload)
  @StellatePurgeType('post', 'id')
  updatePost(@Args('id', { type: () => String }) id: string): PostPayload {
    return { id };
  }

  // Same as above, but no `id` is returned -> should log error and skip API call
  @Mutation(() => PostPayload)
  @StellatePurgeType('post', 'id')
  brokenUpdate(): PostPayload {
    return { ok: 'no-id' };
  }

  // Simple query to ensure the server is running
  @Query(() => String)
  ping(): string {
    return 'pong';
  }
}

describe('StellatePurgeInterceptor (GraphQL e2e, debug)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Build testing module with GraphQL and global interceptor
    const modRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
      ],
      providers: [
        E2eResolver,
        {
          provide: APP_INTERCEPTOR,
          useValue: new StellatePurgeInterceptor({
            serviceName: 'my-stellate-service',
            purgeToken: 'secret',
            debug: true, // enable debug logging
          }),
        },
      ],
    }).compile();

    app = modRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  it('sends _purgeQuery mutation and logs debug info after StellatePurgeQuery mutation', async () => {
    axiosPost.mockResolvedValue({ data: {} });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'mutation { upvotePost(postId:"42") }' })
      .expect(200);

    // Verify GraphQL response
    expect(res.body.data.upvotePost).toBe('upvoted:42');
    // Verify that purge API was called once
    expect(axiosPost).toHaveBeenCalledTimes(1);

    const [url, body, config] = axiosPost.mock.calls[0];
    expect(url).toContain('my-stellate-service');
    expect(config.headers['stellate-token']).toBe('secret');
    expect(body.query).toContain('_purgeQuery');
    expect(body.query).toContain('allPosts');

    // Debug log assertions
    expect(dbgSpy).toHaveBeenCalledWith(expect.stringContaining('Interceptor triggered'));
    expect(dbgSpy).toHaveBeenCalledWith(expect.stringContaining('Generated purge query mutation'));
    expect(dbgSpy).toHaveBeenCalledWith(expect.stringContaining('Sending request to Stellate'));
    expect(dbgSpy).toHaveBeenCalledWith(expect.stringContaining('Response from Stellate'));
    // Success log
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cache was successfully cleared for the queries')
    );
  });

  it('sends purge<Type> mutation when StellatePurgeType is used and id is present', async () => {
    axiosPost.mockResolvedValue({ data: {} });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'mutation { updatePost(id:"A1"){ id } }' })
      .expect(200);

    expect(res.body.data.updatePost.id).toBe('A1');
    expect(axiosPost).toHaveBeenCalledTimes(1);

    const [, body] = axiosPost.mock.calls[0];
    expect(body.query.replace(/\s+/g, ' ')).toMatch(/purgePost\(id:\s*\["A1"\]\)/);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cache was successfully cleared for the type: post')
    );
  });

  it('does NOT call API if idReference is set but id is missing in response', async () => {
    axiosPost.mockResolvedValue({ data: {} }); // should not be used

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'mutation { brokenUpdate { ok } }' })
      .expect(200);

    expect(res.body.data.brokenUpdate.ok).toBe('no-id');
    expect(axiosPost).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('Id reference "id" not found in response object')
    );
  });

  it('returns data but logs error when Stellate API responds with errors', async () => {
    axiosPost.mockResolvedValue({ data: { errors: [{ message: 'boom' }] } });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'mutation { upvotePost(postId:"7") }' })
      .expect(200);

    expect(res.body.data.upvotePost).toBe('upvoted:7');
    expect(axiosPost).toHaveBeenCalledTimes(1);
    expect(dbgSpy).toHaveBeenCalledWith(expect.stringContaining('Response from Stellate'));
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Stellate Purge Api Error'));
  });

  afterAll(async () => {
    await app.close();
    // Restore spies to avoid leaking into other tests
    dbgSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
  });
});
