import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import axios from "axios";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { IStellatePurgeInterceptorOptions } from "./stellate-purge.interface";

@Injectable()
export class StellatePurgeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(StellatePurgeInterceptor.name);

  constructor(
    private readonly options: IStellatePurgeInterceptorOptions = {},
    private readonly reflector: Reflector = new Reflector()
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(async (data) => {
        const stellateQueries = this.reflector.get<string[]>(
          "stellate-purge-queries",
          context.getHandler()
        );

        const stellateType = this.reflector.get<{
          type: string;
          idReference: string | number;
        }>("stellate-purge-type", context.getHandler());

        if (stellateQueries) {
          await this.purgeQueries(stellateQueries);
        }

        if (stellateType?.type) {
          await this.purgeType(
            stellateType?.type,
            stellateType?.idReference,
            data
          );
        }

        return data;
      })
    );
  }

  /**
   * purge queries
   */
  async purgeQueries(queries: string[]): Promise<Boolean> {
    return new Promise(async (resolve) => {
      const query = `mutation { _purgeQuery(queries: [${queries.join(",")}]) }`;

      const successfull = await this.sendPurgeRequest(query);

      if (successfull)
        this.logger.log(
          `Cache was successfully cleared for the queries: ${queries.join(",")}`
        );

      resolve(true);
    });
  }

  /**
   * purge type
   */
  async purgeType(
    type: string,
    idReference: string | number,
    data: any
  ): Promise<Boolean> {
    return new Promise(async (resolve) => {
      if (idReference && !data[idReference]) {
        this.logger.error(
          `Stellate Purge Error: Id reference "${idReference}" not found in response object!`
        );

        resolve(false);
        return;
      }

      const id = idReference && data[idReference];
      const purgeMutationName = `purge${
        type.toString().charAt(0).toUpperCase() + type.toString().slice(1)
      }`;
      const query = `mutation {
          ${purgeMutationName}${id ? `(id: ["${id.toString()}"])` : ""}
        }`;

      const successfull = await this.sendPurgeRequest(query);

      if (successfull)
        this.logger.log(
          `Cache was successfully cleared for the type: ${type.toString()}${
            id ? ` | ID: ${id.toString()}` : ""
          }`
        );

      resolve(true);
    });
  }

  /**
   *
   * @param query
   * @returns
   */
  private async sendPurgeRequest(query: string) {
    return new Promise(async (resolve) => {
      if (!this.options.serviceName || !this.options.purgeToken) {
        this.logger.error(`Stellate missing serviceName and purgeToken`);

        resolve(false);
        return;
      }

      try {
        const { data } = await axios.post(
          `https://admin.stellate.io/${this.options.serviceName}`,
          {
            query,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "stellate-token": this.options.purgeToken,
            },
          }
        );

        if (data?.errors) {
          this.logger.error(
            `Stellate Purge Api Error: ${JSON.stringify(data.errors)}`
          );

          resolve(false);
          return;
        }

        resolve(true);
      } catch (e) {
        this.logger.error(`Stellate Purge Api Error: ${JSON.stringify(e)}`);

        resolve(false);
      }
    });
  }
}
