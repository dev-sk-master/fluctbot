import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCanceledAtToSubscriptions1733000006000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add canceled_at column to track when cancellation was requested
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      ADD COLUMN "canceled_at" TIMESTAMP NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove canceled_at column
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      DROP COLUMN "canceled_at";
    `);
  }
}

