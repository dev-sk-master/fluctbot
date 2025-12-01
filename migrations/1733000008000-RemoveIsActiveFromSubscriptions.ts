import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveIsActiveFromSubscriptions1733000008000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove is_active column (status enum replaces it)
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      DROP COLUMN "is_active";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add is_active column with default
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      ADD COLUMN "is_active" BOOLEAN DEFAULT true;
    `);

    // Populate is_active based on status
    await queryRunner.query(`
      UPDATE "subscriptions" 
      SET "is_active" = (status = 'active'::subscription_status_enum);
    `);
  }
}

