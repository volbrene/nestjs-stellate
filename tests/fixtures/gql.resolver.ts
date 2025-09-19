import { Resolver, Query } from '@nestjs/graphql';
import { StellatePurgeQuery } from '../../src/decorators/stellate-purge-query.decorator';

@Resolver()
export class GqlResolver {
  @Query(() => String)
  @StellatePurgeQuery(['allPosts'])
  async getHello(): Promise<string> {
    return 'Hello';
  }
}
