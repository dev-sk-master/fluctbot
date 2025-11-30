import { Injectable, Logger } from '@nestjs/common';
import { UniversalTool } from '../../universal-agent';
import { FleetsService } from '../../fleets/fleets.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
// @ts-ignore - zod is a peer dependency
import { z } from 'zod';

/**
 * Service to create UniversalTools from existing services
 * This bridges the gap between our NestJS services and UniversalAgent tools
 */
@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(
    private readonly fleetsService: FleetsService,
    private readonly subscriptionsService: SubscriptionsService,
    // TODO: Add more services as needed
    // private readonly remindersService?: RemindersService,
  ) {}

  /**
   * Get all available tools for the AI agent
   */
  getTools(): UniversalTool[] {
    const tools: UniversalTool[] = [];

    // Fleet management tools
    tools.push(...this.getFleetTools());

    // Subscription/Credits tools
    tools.push(...this.getSubscriptionTools());

    // TODO: Add more tool categories
    // tools.push(...this.getReminderTools());

    this.logger.debug(`Created ${tools.length} tools for AI agent`);
    return tools;
  }

  /**
   * Fleet management tools
   */
  private getFleetTools(): UniversalTool[] {
    return [
      {
        name: 'create_fleet',
        description: 'Create a new fleet with a given name. Use this when the user wants to create a new fleet.',
        parameters: z.object({
          name: z.string().describe('The name of the fleet to create'),
          description: z.string().optional().describe('Optional description for the fleet'),
        }),
        execute: async (params: { name: string; description?: string }, context?: { userId: number }) => {
          if (!context?.userId) {
            throw new Error('User ID is required to create a fleet');
          }
          const fleet = await this.fleetsService.createFleet({
            userId: context.userId,
            name: params.name,
            description: params.description,
          });
          return {
            success: true,
            message: `Fleet "${fleet.name}" created successfully with ID ${fleet.id}`,
            fleet: {
              id: fleet.id,
              name: fleet.name,
              description: fleet.description,
            },
          };
        },
      },
      {
        name: 'list_fleets',
        description: 'List all fleets belonging to the user. Use this when the user wants to see their fleets.',
        parameters: z.object({}),
        execute: async (params: {}, context?: { userId: number }) => {
          if (!context?.userId) {
            throw new Error('User ID is required to list fleets');
          }
          const fleets = await this.fleetsService.getUserFleets(context.userId);
          return {
            success: true,
            fleets: fleets.map((fleet) => ({
              id: fleet.id,
              name: fleet.name,
              description: fleet.description,
              createdAt: fleet.createdAt,
            })),
            count: fleets.length,
          };
        },
      },
      {
        name: 'get_fleet_vessels',
        description: 'Get all vessels in a specific fleet. Use this when the user wants to see vessels in a fleet.',
        parameters: z.object({
          fleetId: z.number().describe('The ID of the fleet to get vessels from'),
        }),
        execute: async (params: { fleetId: number }, context?: { userId: number }) => {
          if (!context?.userId) {
            throw new Error('User ID is required to get fleet vessels');
          }
          const vessels = await this.fleetsService.getFleetVessels(params.fleetId, context.userId);
          return {
            success: true,
            vessels: vessels.map((vessel) => ({
              id: vessel.id,
              vesselId: vessel.vesselId,
              createdAt: vessel.createdAt,
            })),
            count: vessels.length,
          };
        },
      },
      {
        name: 'add_vessel_to_fleet',
        description: 'Add a vessel (by IMO number) to a fleet. Use this when the user wants to add a vessel to a fleet.',
        parameters: z.object({
          fleetId: z.number().describe('The ID of the fleet to add the vessel to'),
          vesselId: z.string().describe('The IMO number or vessel identifier'),
        }),
        execute: async (params: { fleetId: number; vesselId: string }, context?: { userId: number }) => {
          if (!context?.userId) {
            throw new Error('User ID is required to add vessel to fleet');
          }
          const fleetVessel = await this.fleetsService.addVesselToFleet(
            {
              fleetId: params.fleetId,
              vesselId: params.vesselId,
            },
            context.userId,
          );
          return {
            success: true,
            message: `Vessel ${params.vesselId} added to fleet successfully`,
            fleetVessel: {
              id: fleetVessel.id,
              fleetId: fleetVessel.fleetId,
              vesselId: fleetVessel.vesselId,
            },
          };
        },
      },
      {
        name: 'remove_vessel_from_fleet',
        description: 'Remove a vessel from a fleet. Use this when the user wants to remove a vessel from a fleet.',
        parameters: z.object({
          fleetId: z.number().describe('The ID of the fleet to remove the vessel from'),
          vesselId: z.string().describe('The IMO number or vessel identifier to remove'),
        }),
        execute: async (params: { fleetId: number; vesselId: string }, context?: { userId: number }) => {
          if (!context?.userId) {
            throw new Error('User ID is required to remove vessel from fleet');
          }
          await this.fleetsService.removeVesselFromFleet(params.fleetId, params.vesselId, context.userId);
          return {
            success: true,
            message: `Vessel ${params.vesselId} removed from fleet successfully`,
          };
        },
      },
      {
        name: 'rename_fleet',
        description: 'Rename a fleet. Use this when the user wants to change the name of a fleet.',
        parameters: z.object({
          fleetId: z.number().describe('The ID of the fleet to rename'),
          newName: z.string().describe('The new name for the fleet'),
        }),
        execute: async (params: { fleetId: number; newName: string }, context?: { userId: number }) => {
          if (!context?.userId) {
            throw new Error('User ID is required to rename fleet');
          }
          const fleet = await this.fleetsService.renameFleet(params.fleetId, params.newName, context.userId);
          return {
            success: true,
            message: `Fleet renamed to "${fleet.name}" successfully`,
            fleet: {
              id: fleet.id,
              name: fleet.name,
            },
          };
        },
      },
      {
        name: 'delete_fleet',
        description: 'Delete a fleet and all its vessels. Use this when the user wants to delete a fleet.',
        parameters: z.object({
          fleetId: z.number().describe('The ID of the fleet to delete'),
        }),
        execute: async (params: { fleetId: number }, context?: { userId: number }) => {
          if (!context?.userId) {
            throw new Error('User ID is required to delete fleet');
          }
          await this.fleetsService.deleteFleet(params.fleetId, context.userId);
          return {
            success: true,
            message: `Fleet ${params.fleetId} deleted successfully`,
          };
        },
      },
    ];
  }

  /**
   * Subscription/Credits tools
   */
  private getSubscriptionTools(): UniversalTool[] {
    return [
      {
        name: 'get_user_subscription',
        description: 'Get the user\'s current subscription details including tier, credit limit, and usage. Use this when the user asks about their subscription or credits.',
        parameters: z.object({}),
        execute: async (params: {}, context?: { userId: number }) => {
          if (!context?.userId) {
            throw new Error('User ID is required to get subscription');
          }
          const subscription = await this.subscriptionsService.getUserActiveSubscription(context.userId);
          if (!subscription) {
            return {
              success: false,
              message: 'No active subscription found',
            };
          }
          return {
            success: true,
            subscription: {
              id: subscription.id,
              tier: subscription.tier,
              creditLimit: subscription.creditLimit,
              creditPeriodUnit: subscription.creditPeriodUnit,
              creditPeriodValue: subscription.creditPeriodValue,
              isActive: subscription.isActive,
              startDate: subscription.startDate,
              endDate: subscription.endDate,
            },
          };
        },
      },
    ];
  }
}

