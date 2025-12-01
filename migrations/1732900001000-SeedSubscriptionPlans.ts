import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSubscriptionPlans1732900001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert Free Plan
    await queryRunner.query(`
      INSERT INTO subscription_plans (
        plan_code,
        name,
        credit_limit,
        credit_period_unit,
        credit_period_value,
        duration_days,
        active,
        metadata,
        capabilities,
        pricing,
        created_at,
        updated_at
      ) VALUES (
        'free',
        'Free Tier',
        10,
        'day',
        1,
        365,
        true,
        jsonb_build_object('stripe_product_id', 'prod_TWVjskWDuc5TWj'),
        '{"fleets": 1, "reminders": 3}',
        '{}',
        NOW(),
        NOW()
      )
      ON CONFLICT (plan_code) DO NOTHING;
    `);

    // Insert Basic Plan
    await queryRunner.query(`
      INSERT INTO subscription_plans (
        plan_code,
        name,
        credit_limit,
        credit_period_unit,
        credit_period_value,
        duration_days,
        active,
        metadata,
        capabilities,
        pricing,
        created_at,
        updated_at
      ) VALUES (
        'basic',
        'Basic Tier',
        50,
        'day',
        1,
        365,
        true,
        jsonb_build_object('stripe_product_id', 'prod_TWVmStuP1yegFh'),
        '{"fleets": 5, "reminders": 20}',
        jsonb_build_object(
          'monthly', jsonb_build_object(
            'amount', 5,
            'stripe_price_id', 'price_1SZSoHHlEU90bP9J3ioSOT1O'
          ),
          'yearly', jsonb_build_object(
            'amount', 50,
            'stripe_price_id', 'price_1SZSkYHlEU90bP9JpwcB0n9P'
          )
        ),
        NOW(),
        NOW()
      )
      ON CONFLICT (plan_code) DO NOTHING;
    `);

    // Insert Pro Plan
    await queryRunner.query(`
      INSERT INTO subscription_plans (
        plan_code,
        name,
        credit_limit,
        credit_period_unit,
        credit_period_value,
        duration_days,
        active,
        metadata,
        capabilities,
        pricing,
        created_at,
        updated_at
      ) VALUES (
        'pro',
        'Pro Tier',
        200,
        'day',
        1,
        365,
        true,
        jsonb_build_object('stripe_product_id', 'prod_TWVmlPBVUtqRhx'),
        '{"fleets": "unlimited", "reminders": "unlimited"}',
        jsonb_build_object(
          'monthly', jsonb_build_object(
            'amount', 10,
            'stripe_price_id', 'price_1SZSnsHlEU90bP9JPx9mTRPn'
          ),
          'yearly', jsonb_build_object(
            'amount', 100,
            'stripe_price_id', 'price_1SZSlHHlEU90bP9JfN2TA5qs'
          )
        ),
        NOW(),
        NOW()
      )
      ON CONFLICT (plan_code) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded plans
    await queryRunner.query(`
      DELETE FROM subscription_plans 
      WHERE plan_code IN ('free', 'basic', 'pro');
    `);
    }
}

