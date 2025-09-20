# 🛰️ NestJS Stellate Module

[![npm version](https://img.shields.io/npm/v/nestjs-stellate.svg)](https://www.npmjs.com/package/nestjs-stellate)
[![CI](https://github.com/volbrene/githooks/actions/workflows/release.yml/badge.svg)](https://github.com/volbrene/githooks/actions)
[![npm downloads](https://img.shields.io/npm/dm/nestjs-stellate.svg)](https://www.npmjs.com/package/nestjs-stellate)
[![license](https://img.shields.io/npm/l/nestjs-stellate.svg)](https://www.npmjs.com/package/nestjs-stellate)

> This lightweight module for [NestJS](https://nestjs.com/) handles cache purge operations via the [Stellate API](https://stellate.io/) and lets you trigger query and type purges using simple decorators.

---

## Installation

```bash
$ npm i --save nestjs-stellate
```

## Quick Start

### Using purge Interceptor

You can attach the `StellatePurgeInterceptor` locally to a single resolver method or register it once as a global interceptor for the entire application.

#### Local usage – `app.resolver.ts`

```ts
  @Mutation()
  @UseInterceptors(new StellatePurgeInterceptor({
      serviceName: '<service-name>', // your Stellate service name
      purgeToken: '<token>',         // API token for Stellate admin API
      debug: false,                  // enable verbose debug logging (optional)
  }))
  async upvotePost(@Args('postId') postId: number) {
    ...
  }
```

#### Global usage – `app.module.ts`

```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StellatePurgeInterceptor } from 'nestjs-stellate';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useValue: new StellatePurgeInterceptor({
        serviceName: '<service-name>', // your Stellate service name
        purgeToken: '<token>', // API token for Stellate admin API
        debug: false, // enable verbose debug logging (optional)
      }),
    },
  ],
})
export class ApplicationModule {}
```

> **💡 Tip:**  
> Use the global interceptor if you want cache purging to work across all resolvers and controllers  
> without adding `@UseInterceptors(...)` to each method manually.

## Available Decorators

### `StellatePurgeQuery`

Use the `StellatePurgeQuery` decorator on a resolver method (typically a mutation) to clear the cache for one or more GraphQL queries after the mutation runs.

Pass an array of query names exactly as they appear in your client operations.

> **Example – app.resolver.ts**

```ts
import { StellatePurgeQuery } from 'nestjs-stellate';

@Mutation(() => Post)
@StellatePurgeQuery(['allPosts', 'feed'])
async upvotePost(@Args('postId') postId: number) {
  // Perform your update
  return this.postService.upvote(postId);
}
```

### `StellatePurgeType`

Use the `StellatePurgeType` decorator on a resolver method (usually a mutation) to clear the cache for a specific type.

The second argument (`<type-id-reference>`) should be the name of a field in the resolver's return object that contains the entity ID.

> **Example – app.resolver.ts**

```ts
import { StellatePurgeType } from 'nestjs-stellate';

@Mutation(() => Post)
@StellatePurgeType('post', 'id')
async upvotePost(@Args('postId') postId: number) {
  // return object must include an "id" field
  return this.postService.upvote(postId);
}
```
