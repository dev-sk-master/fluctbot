import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { AccessControlNode, AccessControlConfig } from '../processor/access-control.node';
import { BaseNode } from '../../core/base-node';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class AccessControlNodeFactory implements NodeFactory {
  constructor(private readonly usersService: UsersService) {}

  getType(): string {
    return 'access-control';
  }

  getDescription(): string {
    return 'Checks if user exists by platform identifier, routes to onboarding if not';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new AccessControlNode(id, name, config as AccessControlConfig, this.usersService);
  }
}

