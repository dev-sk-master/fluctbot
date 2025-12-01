import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class CreateUserCreditsUsage1732800006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_credits_usage',
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
            name: 'date',
            type: 'date',
            default: 'CURRENT_DATE',
            isNullable: true,
          },
          {
            name: 'tokens_used',
            type: 'int',
            default: 0,
          },
          {
            name: 'credit_source',
            type: 'varchar',
            length: '20',
            default: "'subscription'",
          },
          {
            name: 'credits_used',
            type: 'decimal',
            precision: 10,
            scale: 8,
            default: 0,
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

    // Create unique constraint
    await queryRunner.createUniqueConstraint(
      'user_credits_usage',
      new TableUnique({
        name: 'UQ_user_credits_usage_userId_date_creditSource',
        columnNames: ['user_id', 'date', 'credit_source'],
      }),
    );

    // Add foreign key
    const userCreditsUsageTable = await queryRunner.getTable('user_credits_usage');
    const userForeignKey = userCreditsUsageTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('user_id') !== -1 && fk.referencedTableName === 'users',
    );

    if (!userForeignKey) {
      await queryRunner.createForeignKey(
        'user_credits_usage',
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
    await queryRunner.dropTable('user_credits_usage');
  }
}

