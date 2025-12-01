import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateReferrals1732800007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'referrals',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'referrer_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'referred_user_id',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'credit_reward',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 5.0,
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
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

    // Add foreign keys
    const referralsTable = await queryRunner.getTable('referrals');
    
    const referrerForeignKey = referralsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('referrer_id') !== -1 && fk.referencedTableName === 'users',
    );

    if (!referrerForeignKey) {
      await queryRunner.createForeignKey(
        'referrals',
        new TableForeignKey({
          columnNames: ['referrer_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'CASCADE',
        }),
      );
    }

    const referredUserForeignKey = referralsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('referred_user_id') !== -1 && fk.referencedTableName === 'users',
    );

    if (!referredUserForeignKey) {
      await queryRunner.createForeignKey(
        'referrals',
        new TableForeignKey({
          columnNames: ['referred_user_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'SET NULL',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('referrals');
  }
}

