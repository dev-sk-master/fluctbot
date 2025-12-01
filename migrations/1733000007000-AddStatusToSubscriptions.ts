import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToSubscriptions1733000007000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for subscription status
    await queryRunner.query(`
      CREATE TYPE subscription_status_enum AS ENUM ('active', 'inactive', 'cancelled', 'expired');
    `);

    // Add status column (nullable initially for migration)
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      ADD COLUMN "status" subscription_status_enum NULL;
    `);

    // Migrate existing data based on is_active, canceled_at, and end_date
    await queryRunner.query(`
      UPDATE "subscriptions" 
      SET "status" = 
        CASE 
          WHEN "is_active" = true AND ("end_date" IS NULL OR "end_date" > NOW()) THEN 'active'::subscription_status_enum
          WHEN "canceled_at" IS NOT NULL AND ("end_date" IS NULL OR "end_date" > NOW()) THEN 'cancelled'::subscription_status_enum
          WHEN "end_date" IS NOT NULL AND "end_date" < NOW() THEN 'expired'::subscription_status_enum
          ELSE 'inactive'::subscription_status_enum
        END;
    `);

    // Set default value and make NOT NULL
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      ALTER COLUMN "status" SET DEFAULT 'inactive'::subscription_status_enum,
      ALTER COLUMN "status" SET NOT NULL;
    `);

    // Add index for status queries
    await queryRunner.query(`
      CREATE INDEX "idx_subscriptions_status" ON "subscriptions" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_subscriptions_status";
    `);

    // Remove status column
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      DROP COLUMN "status";
    `);

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS subscription_status_enum;
    `);
  }
}

