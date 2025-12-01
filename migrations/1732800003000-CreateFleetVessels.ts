import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class CreateFleetVessels1732800003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'fleet_vessels',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'fleet_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'vessel_id',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create unique constraint
    await queryRunner.createUniqueConstraint(
      'fleet_vessels',
      new TableUnique({
        name: 'UQ_fleet_vessels_fleetId_vesselId',
        columnNames: ['fleet_id', 'vessel_id'],
      }),
    );

    // Add foreign key
    const fleetVesselsTable = await queryRunner.getTable('fleet_vessels');
    const fleetForeignKey = fleetVesselsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('fleet_id') !== -1 && fk.referencedTableName === 'fleets',
    );

    if (!fleetForeignKey) {
      await queryRunner.createForeignKey(
        'fleet_vessels',
        new TableForeignKey({
          columnNames: ['fleet_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'fleets',
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fleet_vessels');
  }
}

