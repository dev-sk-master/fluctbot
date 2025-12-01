import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class UpdateSubscriptionsForPaymentProviders1733000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('subscriptions');

    // Step 1: Add payment_provider column if it doesn't exist
    const hasPaymentProvider = table?.findColumnByName('payment_provider');
    if (!hasPaymentProvider) {
      await queryRunner.addColumn(
        'subscriptions',
        new TableColumn({
          name: 'payment_provider',
          type: 'varchar',
          length: '50',
          isNullable: true,
        }),
      );
      console.log('✅ Added payment_provider column to subscriptions table');
    } else {
      console.log('⚠️  Column payment_provider already exists, skipping');
    }

    // Step 2: Migrate existing data (set all existing subscriptions with stripe_subscription_id to 'stripe')
    const hasStripeSubscriptionId = table?.findColumnByName('stripe_subscription_id');
    if (hasStripeSubscriptionId) {
      await queryRunner.query(`
        UPDATE subscriptions 
        SET payment_provider = 'stripe' 
        WHERE stripe_subscription_id IS NOT NULL 
        AND payment_provider IS NULL
      `);
      console.log('✅ Migrated existing stripe_subscription_id data to payment_provider');
    }

    // Step 3: Rename stripe_subscription_id to payment_provider_subscription_id
    const hasPaymentProviderSubscriptionId = table?.findColumnByName('payment_provider_subscription_id');
    if (hasStripeSubscriptionId && !hasPaymentProviderSubscriptionId) {
      await queryRunner.query(`
        ALTER TABLE subscriptions 
        RENAME COLUMN stripe_subscription_id TO payment_provider_subscription_id
      `);
      console.log('✅ Renamed stripe_subscription_id to payment_provider_subscription_id');
    } else if (hasPaymentProviderSubscriptionId) {
      console.log('⚠️  Column payment_provider_subscription_id already exists, skipping rename');
    } else {
      console.log('⚠️  Column stripe_subscription_id does not exist, skipping rename');
    }

    // Step 4: Add index for performance
    const indexExists = table?.indices.some((idx) => idx.name === 'idx_subscriptions_payment_provider');
    if (!indexExists) {
      await queryRunner.createIndex(
        'subscriptions',
        new TableIndex({
          name: 'idx_subscriptions_payment_provider',
          columnNames: ['payment_provider', 'payment_provider_subscription_id'],
        }),
      );
      console.log('✅ Created index on payment_provider columns');
    } else {
      console.log('⚠️  Index idx_subscriptions_payment_provider already exists, skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('subscriptions');

    // Drop index
    const indexExists = table?.indices.some((idx) => idx.name === 'idx_subscriptions_payment_provider');
    if (indexExists) {
      await queryRunner.dropIndex('subscriptions', 'idx_subscriptions_payment_provider');
      console.log('✅ Dropped index idx_subscriptions_payment_provider');
    }

    // Rename back
    const hasPaymentProviderSubscriptionId = table?.findColumnByName('payment_provider_subscription_id');
    if (hasPaymentProviderSubscriptionId) {
      await queryRunner.query(`
        ALTER TABLE subscriptions 
        RENAME COLUMN payment_provider_subscription_id TO stripe_subscription_id
      `);
      console.log('✅ Renamed payment_provider_subscription_id back to stripe_subscription_id');
    }

    // Drop payment_provider column
    const hasPaymentProvider = table?.findColumnByName('payment_provider');
    if (hasPaymentProvider) {
      await queryRunner.dropColumn('subscriptions', 'payment_provider');
      console.log('✅ Dropped payment_provider column');
    }
  }
}

