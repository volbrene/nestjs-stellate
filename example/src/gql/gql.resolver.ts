import { Query, Resolver } from "@nestjs/graphql";
import { StellatePurgeQuery } from "../../../lib";

@Resolver("Gql")
export class GqlResolver {
  @Query(() => String)
  @StellatePurgeQuery(["allPosts"])
  async getHello() {
    return "Hello";
  }
}
