import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { StellatePurgeInterceptor, StellatePurgeQuery } from "../../lib";

@Controller()
@UseInterceptors(new StellatePurgeInterceptor())
export class AppController {
  @Get()
  @StellatePurgeQuery(["allPosts"])
  getHello(): string {
    return "Hello";
  }
}
