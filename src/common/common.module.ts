import { Module, Global } from '@nestjs/common';
import { OnboardingStateService } from './services/onboarding-state.service';
import { EmailService } from './services/email.service';
import { CommandsService } from './services/commands.service';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    OnboardingStateService,
    EmailService,
    CommandsService,
  ],
  exports: [
    OnboardingStateService,
    EmailService,
    CommandsService,
  ],
})
export class CommonModule {}

