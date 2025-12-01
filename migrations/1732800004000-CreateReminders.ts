import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateReminders1732800004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'reminders',
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
            name: 'reminder_type',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'user_query',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'search_params',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'check_interval_minutes',
            type: 'int',
            default: 5,
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: true,
          },
          {
            name: 'last_checked_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_notified_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notification_message',
            type: 'text',
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

    // Create indexes
    await queryRunner.createIndex(
      'reminders',
      new TableIndex({
        name: 'idx_reminders_is_active',
        columnNames: ['is_active'],
      }),
    );

    await queryRunner.createIndex(
      'reminders',
      new TableIndex({
        name: 'idx_reminders_last_checked',
        columnNames: ['last_checked_at'],
      }),
    );

    await queryRunner.createIndex(
      'reminders',
      new TableIndex({
        name: 'idx_reminders_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Add foreign key
    const remindersTable = await queryRunner.getTable('reminders');
    const userForeignKey = remindersTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('user_id') !== -1 && fk.referencedTableName === 'users',
    );

    if (!userForeignKey) {
      await queryRunner.createForeignKey(
        'reminders',
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
    await queryRunner.dropTable('reminders');
  }
}

