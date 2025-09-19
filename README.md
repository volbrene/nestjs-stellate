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

> app.resolver.ts

```ts
  @Mutation()
  @UseInterceptors(new StellatePurgeInterceptor({
        serviceName: "<service-name>",
        purgeToken: "<token>",
  }))
  async upvotePost(@Args('postId') postId: number) {
    ...
  }
```

#### Global

If you want to set up interceptor as global, you have to follow Nest
instructions [here](https://docs.nestjs.com/interceptors). Something like
this.

> app.module.ts

```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StellatePurgeInterceptor } from 'nestjs-stellate';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useValue: new StellatePurgeInterceptor({
        serviceName: '<service-name>',
        purgeToken: '<token>',
      }),
    },
  ],
})
export class ApplicationModule {}
```

### Use purge query decorator

To purge some queries you can now use the `StellatePurgeQuery` decorator.

> app.resolver.ts

```ts
import { StellatePurgeQuery } from "nestjs-stellate"

@Mutation()
@StellatePurgeQuery(["<query-name>"])
async upvotePost(@Args('postId') postId: number) {
  ...
}
```

### Use purge type decorator

To purge some type you can now use the `StellatePurgeType` decorator.

> app.resolver.ts

```ts
import { StellatePurgeType } from "nestjs-stellate"

@Mutation()
@StellatePurgeType("<type-name>", "<type-id-reference>")
async upvotePost(@Args('postId') postId: number) {
  ...
}
```
