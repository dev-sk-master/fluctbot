import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateSubscriptions1732800005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'tier',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'credit_limit',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 10.0,
          },
          {
            name: 'credit_period_unit',
            type: 'varchar',
            length: '20',
            default: "'day'",
          },
          {
            name: 'credit_period_value',
            type: 'int',
            default: 1,
          },
          {
            name: 'duration_days',
            type: 'int',
            default: 365,
          },
          {
            name: 'start_date',
            type: 'timestamp',
            default: 'now()',
            isNullable: true,
          },
          {
            name: 'end_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: true,
          },
          {
            name: 'stripe_subscription_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
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
      }),
      true,
    );

    // Add foreign key
    const subscriptionsTable = await queryRunner.getTable('subscriptions');
    const userForeignKey = subscriptionsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('user_id') !== -1 && fk.referencedTableName === 'users',
    );

    if (!userForeignKey) {
      await queryRunner.createForeignKey(
        'subscriptions',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('subscriptions');
  }
}

