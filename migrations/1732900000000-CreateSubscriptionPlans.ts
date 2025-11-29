import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class CreateSubscriptionPlans1732900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create subscription_plans table
    await queryRunner.createTable(
      new Table({
        name: 'subscription_plans',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'plan_code',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'credit_limit',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'credit_period_unit',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'credit_period_value',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'duration_days',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'capabilities',
            type: 'jsonb',
            isNullable: true,
            default: "'{}'",
          },
          {
            name: 'pricing',
            type: 'jsonb',
            isNullable: true,
            default: "'{}'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        indices: [
          {
            name: 'subscription_plans_plan_code_key',
            columnNames: ['plan_code'],
            isUnique: true,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('subscription_plans');
  }
}

