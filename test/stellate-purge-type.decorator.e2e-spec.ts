import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GraphQLModule, Query, Resolver, Args, ObjectType, Field } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import * as request from 'supertest';
import axios from 'axios';
import { StellatePurgeType } from '../src/decorators/stellate-purge-type.decorator';
import { StellateModule } from '../src/stellate.module';

jest.mock('axios');
const axiosPost = axios.post as jest.Mock;

// quiet logs
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

// --- GraphQL Payloads
@ObjectType()
class UserPayload {
  @Field(() => String)
  id!: string;
}

@ObjectType()
class SimplePayload {
  @Field(() => String)
  ok!: string;
}

// --- Test Resolver(s)
@Resolver()
class StellatePurgeTypeResolver {
  // Triggers purgeUser(id: ["<id>"]); resolver returns an object that includes { id }
  @Query(() => UserPayload)
  @StellatePurgeType('user', 'id')
  user(@Args('id', { type: () => String }) id: string): UserPayload {
    return { id };
  }

  // Triggers purgeArticle without id
  @Query(() => SimplePayload)
  @StellatePurgeType('article')
  article(): SimplePayload {
    return { ok: 'ok' };
  }

  // Misconfigured: idReference = 'id' but resolver doesn't include it -> interceptor must not call axios
  @Query(() => SimplePayload)
  @StellatePurgeType('user', 'id')
  brokenUser(): SimplePayload {
    return { ok: 'no-id-in-payload' };
  }
}

describe('StellatePurgeType (e2e, object payloads)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
        StellateModule.forRoot({
          serviceName: 'my-stellate-service',
          purgeToken: 'secret',
        }),
      ],
      providers: [StellatePurgeTypeResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  it('purges type with id when idReference is present on object payload', async () => {
    axiosPost.mockResolvedValue({ data: {} });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'query { user(id: "42") { id } }' })
      .expect(200);

    expect(res.body.data.user.id).toBe('42');
    expect(axiosPost).toHaveBeenCalledTimes(1);

    const [url, body, config] = axiosPost.mock.calls[0];
    expect(url).toContain('my-stellate-service');
    expect(config.headers['stellate-token']).toBe('secret');
    // should build: purgeUser(id: ["42"])
    expect(body.query.replace(/\s+/g, ' ')).toMatch(/mutation { .*purgeUser\(id:\s*\["42"\]\).*/);
  });

  it('purges type without id when no idReference is provided', async () => {
    axiosPost.mockResolvedValue({ data: {} });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ article { ok } }' })
      .expect(200);

    expect(res.body.data.article.ok).toBe('ok');
    expect(axiosPost).toHaveBeenCalledTimes(1);

    const [, body] = axiosPost.mock.calls[0];
    expect(body.query.replace(/\s+/g, ' ')).toMatch(/mutation { .*purgeArticle[^)]* }/);
    expect(body.query).not.toMatch(/id:/);
  });

  it('does NOT call API if idReference configured but missing in object payload', async () => {
    axiosPost.mockResolvedValue({ data: {} }); // should not be reached

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ brokenUser { ok } }' })
      .expect(200);

    expect(res.body.data.brokenUser.ok).toBe('no-id-in-payload');
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it('still returns data if Stellate responds with errors', async () => {
    axiosPost.mockResolvedValue({ data: { errors: [{ message: 'boom' }] } });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'query { user(id: "7") { id } }' })
      .expect(200);

    expect(res.body.data.user.id).toBe('7');
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  afterAll(async () => app.close());
});
