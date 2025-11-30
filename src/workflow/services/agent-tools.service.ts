import { Injectable, Logger } from '@nestjs/common';
import { UniversalTool } from '../../universal-agent';
import { WebSearchToolsRegistry } from './tool-registries/web-search-tools.registry';
import { DatalisticToolsRegistry } from './tool-registries/datalistic-tools.registry';

/**
 * Agent Tools Service
 * Orchestrates all tool registries and provides unified access to AI agent tools
 */
@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(
    private readonly webSearchToolsRegistry: WebSearchToolsRegistry,
    private readonly datalisticToolsRegistry: DatalisticToolsRegistry,
    // TODO: Add more registries as needed
    // private readonly fleetToolsRegistry?: FleetManagementToolsRegistry,
    // private readonly subscriptionToolsRegistry?: SubscriptionToolsRegistry,
  ) {}

  /**
   * Get all available tools for the AI agent
   * Aggregates tools from all registries
   */
  getTools(): UniversalTool[] {
    const tools: UniversalTool[] = [];

    // Web search tools (Tavily, Wikipedia, Weather)
    tools.push(...this.webSearchToolsRegistry.getTools());

    // Maritime data tools (Datalistic)
    tools.push(...this.datalisticToolsRegistry.getTools());

    // TODO: Add more tool categories
    // Fleet management tools
    // tools.push(...this.fleetRegistry?.getTools() || []);

    // Subscription/Credits tools
    // tools.push(...this.subscriptionRegistry?.getTools() || []);

    this.logger.debug(`Created ${tools.length} tools for AI agent`);
    return tools;
  }
}
