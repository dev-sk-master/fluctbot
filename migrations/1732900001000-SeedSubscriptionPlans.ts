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
        '{}',
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
        '{}',
        '{"fleets": 5, "reminders": 20}',
        '{"monthly": 5, "yearly": 50}',
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
        '{}',
        '{"fleets": "unlimited", "reminders": "unlimited"}',
        '{"monthly": 10, "yearly": 100}',
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

