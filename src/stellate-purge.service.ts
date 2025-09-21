import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { STELLATE_OPTIONS, StellateModuleOptions } from './stellate.tokens';
import axios from 'axios';

@Injectable()
export class StellatePurgeService implements OnModuleInit {
  private readonly logger = new Logger(StellatePurgeService.name);
  private enabled = true;

  constructor(@Inject(STELLATE_OPTIONS) private readonly options: StellateModuleOptions) {}

  /**
   * Wird automatisch von NestJS beim Modul-Init aufgerufen.
   */
  onModuleInit() {
    const missing: string[] = [];

    if (!this.options.serviceName) missing.push('serviceName');
    if (!this.options.purgeToken) missing.push('purgeToken');

    if (missing.length > 0) {
      this.logger.error(`Missing configuration: ${missing.join(', ')}. Purge is disabled.`);
      this.enabled = false;
      return;
    }
  }

  /** Public getter für andere Klassen (z. B. Interceptor) */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Purge a list of queries from Stellate cache
   *
   * @param queries
   * @returns
   */
  async purgeQueries(queries: string[]): Promise<boolean> {
    if (!this.enabled) return false;

    const query = `mutation { _purgeQuery(queries: [${queries.join(',')}]) }`;

    if (this.options.debug) {
      this.logger.debug(`Queries from metadata: ${JSON.stringify(queries)}`);
      this.logger.debug(`Generated purge query mutation: ${query}`);
    }

    const successful = await this.sendPurgeRequest(query);

    if (successful && this.options.debug) {
      this.logger.log(`Cache was successfully cleared for the queries: ${queries.join(',')}`);
    }

    return true;
  }

  /**
   * Purge a single type (optionally by ID) from Stellate cache
   *
   * @param type
   * @param idReference
   * @param data
   * @returns
   */
  async purgeType(
    type: string,
    idReference: string | number | undefined,
    data: Record<string, any>
  ): Promise<boolean> {
    if (!this.enabled) return false;

    if (this.options.debug) {
      this.logger.debug(`Type from metadata: ${type} | idReference: ${idReference}`);
    }

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

    if (successful && this.options.debug) {
      this.logger.log(
        `Cache was successfully cleared for the type: ${type}${id ? ` | ID: ${id}` : ''}`
      );
    }

    return true;
  }

  /**
   * Send the purge mutation to Stellate Admin API
   *
   * @param query
   * @returns
   */
  private async sendPurgeRequest(query: string): Promise<boolean> {
    try {
      if (this.options.debug) {
        this.logger.debug(
          `Sending request to Stellate: https://admin.stellate.io/${this.options.serviceName}`
        );

        this.logger.debug(`Request payload: ${query}`);
      }

      const { data } = await axios.post(
        `https://admin.stellate.co/${this.options.serviceName}`,
        { query },
        {
          headers: {
            'Content-Type': 'application/json',
            'stellate-token': this.options.purgeToken,
          },
          timeout: 3000,
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
