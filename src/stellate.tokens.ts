export const STELLATE_OPTIONS = Symbol('STELLATE_OPTIONS');

export interface StellateModuleOptions {
  serviceName: string;
  purgeToken: string;
  debug?: boolean;
}
