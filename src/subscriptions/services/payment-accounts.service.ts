import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentAccount, PaymentProvider } from '../entities/payment-account.entity';
import { UsersService } from '../../users/users.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentAccountsService {
  private readonly logger = new Logger(PaymentAccountsService.name);

  constructor(
    @InjectRepository(PaymentAccount)
    private readonly paymentAccountRepository: Repository<PaymentAccount>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Get or create a Stripe customer for a user
   * This ensures one customer per user in Stripe
   */
  async getOrCreateStripeCustomer(
    userId: number,
    stripe: Stripe,
    userEmail?: string,
    userName?: string,
  ): Promise<string> {
    // Check if user already has Stripe account
    let account = await this.paymentAccountRepository.findOne({
      where: { userId, paymentProvider: PaymentProvider.STRIPE },
    });

    if (account) {
      // Verify customer exists in Stripe
      try {
        const customer = await stripe.customers.retrieve(account.paymentProviderIdentifier);
        if (customer && !customer.deleted) {
          this.logger.debug(
            `Using existing Stripe customer ${account.paymentProviderIdentifier} for user ${userId}`,
          );
          return account.paymentProviderIdentifier;
        }
      } catch (error) {
        this.logger.warn(
          `Stripe customer ${account.paymentProviderIdentifier} not found, creating new one: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Customer doesn't exist, will create a new one below
        // Delete the invalid account record
        await this.paymentAccountRepository.remove(account);
        account = null;
      }
    }

    // Create new Stripe customer
    const user = await this.usersService.findOne(userId);
    const customerEmail = userEmail || user.email;
    const customerName = userName || user.name;

    const customer = await stripe.customers.create({
      email: customerEmail,
      name: customerName,
      metadata: {
        user_id: String(userId),
      },
    });

    this.logger.log(`Created new Stripe customer ${customer.id} for user ${userId}`);

    // Save to payment_accounts
    account = this.paymentAccountRepository.create({
      userId,
      paymentProvider: PaymentProvider.STRIPE,
      paymentProviderIdentifier: customer.id,
      isPrimary: true,
    });
    await this.paymentAccountRepository.save(account);

    return customer.id;
  }

  /**
   * Get payment account by provider
   */
  async getPaymentAccount(
    userId: number,
    paymentProvider: PaymentProvider,
  ): Promise<PaymentAccount | null> {
    return await this.paymentAccountRepository.findOne({
      where: { userId, paymentProvider },
    });
  }

  /**
   * Get primary payment account
   */
  async getPrimaryPaymentAccount(userId: number): Promise<PaymentAccount | null> {
    return await this.paymentAccountRepository.findOne({
      where: { userId, isPrimary: true },
    });
  }

  /**
   * Get all payment accounts for a user
   */
  async getUserPaymentAccounts(userId: number): Promise<PaymentAccount[]> {
    return await this.paymentAccountRepository.find({
      where: { userId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  /**
   * Set primary payment account
   */
  async setPrimaryPaymentAccount(userId: number, paymentProvider: PaymentProvider): Promise<void> {
    // Set all accounts to non-primary
    await this.paymentAccountRepository.update({ userId }, { isPrimary: false });

    // Set the specified account as primary
    await this.paymentAccountRepository.update(
      { userId, paymentProvider },
      { isPrimary: true },
    );
  }
}

