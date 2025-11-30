import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { CommandNode, CommandConfig } from '../processor/command.node';
import { BaseNode } from '../../core/base-node';
import { CommandsService } from '../../../common/services/commands.service';
import { UsersService } from '../../../users/users.service';
import { SubscriptionsService } from '../../../subscriptions/subscriptions.service';
import { FleetsService } from '../../../fleets/fleets.service';

@Injectable()
export class CommandNodeFactory implements NodeFactory {
  constructor(
    private readonly commandsService: CommandsService,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly fleetsService: FleetsService,
    // TODO: Add these services when they are created
    // private readonly remindersService?: RemindersService,
    // private readonly userCreditsUsageService?: UserCreditsUsageService,
  ) {}

  getType(): string {
    return 'command';
  }

  getDescription(): string {
    return 'Handles bot commands from any platform (Telegram, Web Chat, etc.)';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new CommandNode(
      id,
      name,
      config as CommandConfig,
      this.commandsService,
      this.usersService,
      this.subscriptionsService,
      this.fleetsService,
      // TODO: Pass these services when available
      // this.remindersService,
      // this.userCreditsUsageService,
    );
  }
}

