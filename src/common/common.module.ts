import { Module, Global } from '@nestjs/common';
import { OnboardingStateService } from './services/onboarding-state.service';
import { EmailVerificationService } from './services/email-verification.service';
import { CommandsService } from './services/commands.service';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    OnboardingStateService,
    EmailVerificationService,
    CommandsService,
  ],
  exports: [
    OnboardingStateService,
    EmailVerificationService,
    CommandsService,
  ],
})
export class CommonModule {}

