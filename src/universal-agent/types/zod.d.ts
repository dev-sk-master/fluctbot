/**
 * Type declarations for optional peer dependencies
 * These are declared to avoid TypeScript errors when packages aren't installed
 */

declare module "zod" {
  export const z: any;
  export default z;
}

