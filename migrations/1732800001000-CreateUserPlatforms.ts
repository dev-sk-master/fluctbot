import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class CreateUserPlatforms1732800001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_platforms',
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
            name: 'platform',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'platform_identifier',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'linked_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create unique constraints
    await queryRunner.createUniqueConstraint(
      'user_platforms',
      new TableUnique({
        name: 'UQ_user_platforms_platform_platformIdentifier',
        columnNames: ['platform', 'platform_identifier'],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'user_platforms',
      new TableUnique({
        name: 'UQ_user_platforms_userId_platform',
        columnNames: ['user_id', 'platform'],
      }),
    );

    // Create index
    await queryRunner.createIndex(
      'user_platforms',
      new TableIndex({
        name: 'IDX_user_platforms_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Add foreign key
    const userPlatformsTable = await queryRunner.getTable('user_platforms');
    const userForeignKey = userPlatformsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('user_id') !== -1 && fk.referencedTableName === 'users',
    );

    if (!userForeignKey) {
      await queryRunner.createForeignKey(
        'user_platforms',
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
    await queryRunner.dropTable('user_platforms');
  }
}

