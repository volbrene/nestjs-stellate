import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import axios from 'axios';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IStellatePurgeInterceptorOptions } from './stellate-purge.interface';

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
          'stellate-purge-queries',
          context.getHandler()
        );

        const stellateType = this.reflector.get<{
          type: string;
          idReference: string | number;
        }>('stellate-purge-type', context.getHandler());

        if (this.options.debug) {
          this.logger.debug(`Interceptor triggered for handler: ${context.getHandler().name}`);
        }

        if (stellateQueries) {
          this.logger.debug(`Queries from metadata: ${JSON.stringify(stellateQueries)}`);

          await this.purgeQueries(stellateQueries);
        }

        if (stellateType?.type) {
          this.logger.debug(`Type from metadata: ${JSON.stringify(stellateType)}`);

          await this.purgeType(stellateType.type, stellateType.idReference, data);
        }

        return data;
      })
    );
  }

  /**
   * Purge a list of queries from Stellate cache
   */
  async purgeQueries(queries: string[]): Promise<boolean> {
    const query = `mutation { _purgeQuery(queries: [${queries.join(',')}]) }`;

    if (this.options.debug) {
      this.logger.debug(`Generated purge query mutation: ${query}`);
    }

    const successful = await this.sendPurgeRequest(query);

    if (successful) {
      this.logger.log(`Cache was successfully cleared for the queries: ${queries.join(',')}`);
    }

    return true;
  }

  /**
   * Purge a single type (optionally by ID) from Stellate cache
   */
  async purgeType(
    type: string,
    idReference: string | number | undefined,
    data: Record<string, any>
  ): Promise<boolean> {
    // if an idReference is configured but not present in response data → abort
    if (idReference && !data[idReference]) {
      this.logger.error(
        `Stellate Purge Error: Id reference "${idReference}" not found in response object!`
      );
      return false;
    }

    const id = idReference ? data[idReference] : undefined;
    const purgeMutationName = `purge${type.charAt(0).toUpperCase()}${type.slice(1)}`;

    const query = `mutation {
      ${purgeMutationName}${id ? `(id: ["${id}"])` : ''}
    }`;

    if (this.options.debug) {
      this.logger.debug(`Generated purge type mutation: ${query}`);
    }

    const successful = await this.sendPurgeRequest(query);

    if (successful) {
      this.logger.log(
        `Cache was successfully cleared for the type: ${type}${id ? ` | ID: ${id}` : ''}`
      );
    }

    return true;
  }

  /**
   * Send the purge mutation to Stellate Admin API
   */
  private async sendPurgeRequest(query: string): Promise<boolean> {
    if (!this.options.serviceName || !this.options.purgeToken) {
      this.logger.error('Stellate missing serviceName and purgeToken');
      return false;
    }

    try {
      if (this.options.debug) {
        this.logger.debug(
          `Sending request to Stellate: https://admin.stellate.io/${this.options.serviceName}`
        );

        this.logger.debug(`Request payload: ${query}`);
      }

      const { data } = await axios.post(
        `https://admin.stellate.co/${this.options.serviceName}`,
        query,
        {
          headers: {
            'Content-Type': 'application/json',
            'stellate-token': this.options.purgeToken,
          },
        }
      );

      if (this.options.debug) {
        this.logger.debug(`Response from Stellate: ${JSON.stringify(data)}`);
      }

      if (data?.errors) {
        this.logger.error(`Stellate Purge Api Error: ${JSON.stringify(data.errors)}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(`Stellate Purge Api Error: ${JSON.stringify(err)}`);
      return false;
    }
  }
}
