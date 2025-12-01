import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe/stripe.service';
import { StripeWebhookService } from './stripe/stripe-webhook.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import Stripe from 'stripe';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create a Stripe checkout session for subscription' })
  @ApiResponse({ status: 200, description: 'Checkout session created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 500, description: 'Failed to create checkout session' })
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    // Get plan from database
    const plan = await this.subscriptionsService.getPlanByCode(dto.planCode);
    if (!plan) {
      throw new BadRequestException(`Plan with code '${dto.planCode}' not found`);
    }

    if (!plan.active) {
      throw new BadRequestException(`Plan '${dto.planCode}' is not active`);
    }

    // Create checkout session
    const session = await this.stripeService.createCheckoutSession(
      {
        planCode: dto.planCode,
        userId: dto.userId,
        platform: dto.platform,
        platformIdentifier: dto.platformIdentifier,
        priceId: dto.priceId,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
      },
      plan,
    );

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans' })
  @ApiResponse({ status: 200, description: 'List of subscription plans' })
  async getPlans() {
    const plans = await this.subscriptionsService.getAllPlans();
    return {
      plans: plans.map((plan) => ({
        code: plan.planCode,
        name: plan.name,
        creditLimit: plan.creditLimit,
        creditPeriodUnit: plan.creditPeriodUnit,
        creditPeriodValue: plan.creditPeriodValue,
        durationDays: plan.durationDays,
        capabilities: plan.capabilities,
        pricing: plan.pricing,
        active: plan.active,
      })),
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature for verification',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!this.stripeService.isConfigured()) {
      this.logger.warn('Stripe webhook received but Stripe is not configured');
      return { received: true };
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set, skipping signature verification');
      // In production, you should always verify webhook signatures
      // For now, we'll process the event without verification
      // Note: req.body should be parsed JSON when rawBody is enabled
      const event = (req.body as any) as Stripe.Event;
      await this.stripeWebhookService.handleWebhookEvent(event);
      return { received: true };
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new BadRequestException('Raw body is required for webhook verification');
      }

      // rawBody can be Buffer or string
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
      
      event = this.stripeService.verifyWebhookSignature(
        bodyBuffer,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // Handle the event
    await this.stripeWebhookService.handleWebhookEvent(event);

    return { received: true };
  }
}

