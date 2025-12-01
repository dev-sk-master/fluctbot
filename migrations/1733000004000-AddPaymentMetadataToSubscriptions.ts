import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentMetadataToSubscriptions1733000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('subscriptions');

    // Add payment_metadata column if it doesn't exist
    const hasPaymentMetadata = table?.findColumnByName('payment_metadata');
    if (!hasPaymentMetadata) {
      await queryRunner.addColumn(
        'subscriptions',
        new TableColumn({
          name: 'payment_metadata',
          type: 'jsonb',
          default: "'{}'",
          isNullable: true,
        }),
      );
      console.log('✅ Added payment_metadata column to subscriptions table');
    } else {
      console.log('⚠️  Column payment_metadata already exists, skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('subscriptions');

    // Drop payment_metadata column
    const hasPaymentMetadata = table?.findColumnByName('payment_metadata');
    if (hasPaymentMetadata) {
      await queryRunner.dropColumn('subscriptions', 'payment_metadata');
      console.log('✅ Dropped payment_metadata column');
    }
  }
}

