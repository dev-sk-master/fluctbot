import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class CreatePaymentAccounts1733000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists
    const tableExists = await queryRunner.hasTable('payment_accounts');

    if (!tableExists) {
      // Create payment_accounts table
      await queryRunner.createTable(
        new Table({
          name: 'payment_accounts',
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
              name: 'payment_provider',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'payment_provider_identifier',
              type: 'varchar',
              length: '255',
              isNullable: false,
            },
            {
              name: 'is_primary',
              type: 'boolean',
              default: false,
            },
            {
              name: 'metadata',
              type: 'jsonb',
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
        }),
        true,
      );

      // Add foreign key to users table
      await queryRunner.createForeignKey(
        'payment_accounts',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'CASCADE',
        }),
      );

      // Create unique constraints
      await queryRunner.createUniqueConstraint(
        'payment_accounts',
        new TableUnique({
          name: 'payment_accounts_payment_provider_identifier_unique',
          columnNames: ['payment_provider', 'payment_provider_identifier'],
        }),
      );

      await queryRunner.createUniqueConstraint(
        'payment_accounts',
        new TableUnique({
          name: 'payment_accounts_user_provider_unique',
          columnNames: ['user_id', 'payment_provider'],
        }),
      );

      // Create indexes for performance
      await queryRunner.createIndex(
        'payment_accounts',
        new TableIndex({
          name: 'idx_payment_accounts_user_id',
          columnNames: ['user_id'],
        }),
      );

      await queryRunner.createIndex(
        'payment_accounts',
        new TableIndex({
          name: 'idx_payment_accounts_payment_provider',
          columnNames: ['payment_provider'],
        }),
      );

      await queryRunner.createIndex(
        'payment_accounts',
        new TableIndex({
          name: 'idx_payment_accounts_is_primary',
          columnNames: ['user_id', 'is_primary'],
          where: 'is_primary = true',
        }),
      );

      console.log('✅ Created payment_accounts table');
    } else {
      console.log('⚠️  Table payment_accounts already exists, skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('payment_accounts');

    if (tableExists) {
      // Drop indexes first
      const table = await queryRunner.getTable('payment_accounts');
      if (table) {
        const indexes = table.indices;
        for (const index of indexes) {
          if (index.name) {
            await queryRunner.dropIndex('payment_accounts', index.name);
          }
        }

        // Drop foreign keys
        const foreignKeys = table.foreignKeys;
        for (const fk of foreignKeys) {
          await queryRunner.dropForeignKey('payment_accounts', fk);
        }

        // Drop unique constraints
        const uniqueConstraints = table.uniques;
        for (const unique of uniqueConstraints) {
          await queryRunner.dropUniqueConstraint('payment_accounts', unique);
        }
      }

      // Drop table
      await queryRunner.dropTable('payment_accounts');
      console.log('✅ Dropped payment_accounts table');
    } else {
      console.log('⚠️  Table payment_accounts does not exist, skipping');
    }
  }
}

