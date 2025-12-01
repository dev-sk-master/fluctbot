import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTierToPlanCodeInSubscriptions1733000005000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename column from tier to plan_code
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      RENAME COLUMN "tier" TO "plan_code";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: rename plan_code back to tier
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      RENAME COLUMN "plan_code" TO "tier";
    `);
  }
}

