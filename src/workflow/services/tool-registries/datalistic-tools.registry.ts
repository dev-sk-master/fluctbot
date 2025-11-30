import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UniversalTool, InferToolParams } from '../../../universal-agent';
import axios from 'axios';
// @ts-ignore - zod is a peer dependency
import { z } from 'zod';

/**
 * Datalistic Maritime Data Tools Registry
 * Provides vessel information, AIS positions, port search, and vessel specifications
 */
@Injectable()
export class DatalisticToolsRegistry {
  private readonly logger = new Logger(DatalisticToolsRegistry.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('DATALISTIC_BASE_URL') || 'https://api.datalistic.com';
    this.apiKey = this.configService.get<string>('DATALISTIC_API_KEY');
  }

  /**
   * Get all Datalistic maritime tools
   */
  getTools(): UniversalTool[] {
    return [
      this.getVesselInfoTool(),
      this.getAISPositionTool(),
      this.searchPortsTool(),
      this.getVesselSpecsTool(),
    ];
  }

  /**
   * Get vessel information by IMO, MMSI, or name
   */
  private getVesselInfoTool(): UniversalTool {
    const paramsSchema = z.object({
      identifier: z.string().describe('Vessel identifier: IMO number (e.g., "9571648"), MMSI (e.g., "123456789"), or vessel name'),
      type: z.enum(['imo', 'mmsi', 'name']).optional().describe('Type of identifier: imo, mmsi, or name. If not specified, will try to detect automatically'),
    });

    return {
      name: 'get_vessel_info',
      description: 'Get vessel information by IMO number, MMSI, or vessel name. Use this when the user asks about a specific vessel.',
      parameters: paramsSchema,
      execute: async (params: InferToolParams<typeof paramsSchema>) => {
        this.logger.log(`[Tool: get_vessel_info] Called with identifier: "${params.identifier}", type: ${params.type || 'auto-detect'}`);
        try {
          const identifierType = params.type || this.detectIdentifierType(params.identifier);
          const endpoint = this.getVesselEndpoint(identifierType);

          this.logger.debug(`[Tool: get_vessel_info] Executing request to ${endpoint}...`);
          const response = await this.makeRequest(endpoint, {
            [identifierType]: params.identifier,
          });

          const result = {
            success: true,
            identifier: params.identifier,
            type: identifierType,
            vessel: response.data || response,
            summary: this.formatVesselInfo(response.data || response),
          };
          this.logger.log(`[Tool: get_vessel_info] Executed successfully for ${identifierType}: "${params.identifier}"`);
          return result;
        } catch (error) {
          this.logger.error(`[Tool: get_vessel_info] Error: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Failed to get vessel information: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
    };
  }

  /**
   * Get current AIS position of a vessel
   */
  private getAISPositionTool(): UniversalTool {
    const paramsSchema = z.object({
      identifier: z.string().describe('Vessel identifier: IMO number or MMSI'),
      type: z.enum(['imo', 'mmsi']).optional().describe('Type of identifier: imo or mmsi. If not specified, will try to detect automatically'),
    });

    return {
      name: 'get_ais_position',
      description: 'Get current AIS (Automatic Identification System) position of a vessel by IMO or MMSI. Use this to find where a vessel is currently located.',
      parameters: paramsSchema,
      execute: async (params: InferToolParams<typeof paramsSchema>) => {
        this.logger.log(`[Tool: get_ais_position] Called with identifier: "${params.identifier}", type: ${params.type || 'auto-detect'}`);
        try {
          const identifierType = params.type || this.detectIdentifierType(params.identifier);
          
          if (identifierType === 'name') {
            throw new Error('AIS position requires IMO or MMSI, not vessel name');
          }

          this.logger.debug(`[Tool: get_ais_position] Executing request to /ais/position...`);
          const response = await this.makeRequest('/ais/position', {
            [identifierType]: params.identifier,
          });

          const position = response.data || response;

          const summary = `AIS Position for ${params.identifier}:\n` +
            `Latitude: ${position.latitude}\n` +
            `Longitude: ${position.longitude}\n` +
            `Speed: ${position.speed || 'N/A'} knots\n` +
            `Course: ${position.course || 'N/A'}°\n` +
            `Last Update: ${position.timestamp || position.lastUpdate || 'N/A'}`;

          const result = {
            success: true,
            identifier: params.identifier,
            position: {
              latitude: position.latitude,
              longitude: position.longitude,
              speed: position.speed,
              course: position.course,
              timestamp: position.timestamp || position.lastUpdate,
            },
            summary,
          };
          this.logger.log(`[Tool: get_ais_position] Executed successfully. Position: ${position.latitude}, ${position.longitude}`);
          return result;
        } catch (error) {
          this.logger.error(`[Tool: get_ais_position] Error: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Failed to get AIS position: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
    };
  }

  /**
   * Search ports by name or WPI number
   */
  private searchPortsTool(): UniversalTool {
    const paramsSchema = z.object({
      query: z.string().describe('Port name or WPI number to search for'),
      maxResults: z.number().optional().default(10).describe('Maximum number of results to return (default: 10)'),
    });

    return {
      name: 'search_ports',
      description: 'Search for ports by name or WPI (World Port Index) number. Use this when the user asks about ports or port information.',
      parameters: paramsSchema,
      execute: async (params: InferToolParams<typeof paramsSchema>) => {
        this.logger.log(`[Tool: search_ports] Called with query: "${params.query}", maxResults: ${params.maxResults || 10}`);
        try {
          this.logger.debug(`[Tool: search_ports] Executing request to /ports/search...`);
          const response = await this.makeRequest('/ports/search', {
            query: params.query,
            limit: params.maxResults || 10,
          });

          const ports = Array.isArray(response.data) ? response.data : (response.results || []);

          let summary = `Found ${ports.length} port(s):\n\n`;
          ports.forEach((port: any, index: number) => {
            summary += `${index + 1}. ${port.name || port.portName}\n`;
            if (port.wpi) summary += `   WPI: ${port.wpi}\n`;
            if (port.country) summary += `   Country: ${port.country}\n`;
            if (port.latitude && port.longitude) {
              summary += `   Location: ${port.latitude}, ${port.longitude}\n`;
            }
            summary += '\n';
          });

          const result = {
            success: true,
            query: params.query,
            ports: ports.map((p: any) => ({
              name: p.name || p.portName,
              wpi: p.wpi,
              country: p.country,
              latitude: p.latitude,
              longitude: p.longitude,
            })),
            count: ports.length,
            summary,
          };
          this.logger.log(`[Tool: search_ports] Executed successfully. Found ${ports.length} port(s)`);
          return result;
        } catch (error) {
          this.logger.error(`[Tool: search_ports] Error: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Failed to search ports: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
    };
  }

  /**
   * Get vessel specifications
   */
  private getVesselSpecsTool(): UniversalTool {
    const paramsSchema = z.object({
      identifier: z.string().describe('Vessel identifier: IMO number, MMSI, or vessel name'),
      type: z.enum(['imo', 'mmsi', 'name']).optional().describe('Type of identifier: imo, mmsi, or name. If not specified, will try to detect automatically'),
    });

    return {
      name: 'get_vessel_specs',
      description: 'Get detailed vessel specifications including dimensions, capacity, engine details, etc. by IMO, MMSI, or name.',
      parameters: paramsSchema,
      execute: async (params: InferToolParams<typeof paramsSchema>) => {
        this.logger.log(`[Tool: get_vessel_specs] Called with identifier: "${params.identifier}", type: ${params.type || 'auto-detect'}`);
        try {
          const identifierType = params.type || this.detectIdentifierType(params.identifier);
          const endpoint = this.getVesselSpecsEndpoint(identifierType);

          this.logger.debug(`[Tool: get_vessel_specs] Executing request to ${endpoint}...`);
          const response = await this.makeRequest(endpoint, {
            [identifierType]: params.identifier,
          });

          const specs = response.data || response;

          const summary = `Vessel Specifications for ${params.identifier}:\n` +
            `Name: ${specs.name || specs.vesselName || 'N/A'}\n` +
            `IMO: ${specs.imo || 'N/A'}\n` +
            `MMSI: ${specs.mmsi || 'N/A'}\n` +
            `Type: ${specs.vesselType || specs.type || 'N/A'}\n` +
            `Length: ${specs.length || specs.lengthOverall || 'N/A'} m\n` +
            `Width: ${specs.width || specs.beam || 'N/A'} m\n` +
            `Draft: ${specs.draft || 'N/A'} m\n` +
            `Gross Tonnage: ${specs.grossTonnage || specs.gt || 'N/A'}\n` +
            `Deadweight: ${specs.deadweight || specs.dwt || 'N/A'} tons`;

          const result = {
            success: true,
            identifier: params.identifier,
            type: identifierType,
            specs,
            summary,
          };
          this.logger.log(`[Tool: get_vessel_specs] Executed successfully for ${identifierType}: "${params.identifier}"`);
          return result;
        } catch (error) {
          this.logger.error(`[Tool: get_vessel_specs] Error: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Failed to get vessel specifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
    };
  }

  /**
   * Make HTTP request to Datalistic API
   */
  private async makeRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      // Alternative: headers['X-API-Key'] = this.apiKey;
    }

    try {
      const response = await axios.get(url, {
        params,
        headers,
        timeout: 15000,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Datalistic API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Detect identifier type (IMO, MMSI, or name)
   */
  private detectIdentifierType(identifier: string): 'imo' | 'mmsi' | 'name' {
    // IMO numbers are typically 7 digits
    if (/^\d{7}$/.test(identifier)) {
      return 'imo';
    }
    // MMSI numbers are typically 9 digits
    if (/^\d{9}$/.test(identifier)) {
      return 'mmsi';
    }
    // Otherwise, assume it's a name
    return 'name';
  }

  /**
   * Get vessel endpoint based on identifier type
   */
  private getVesselEndpoint(type: 'imo' | 'mmsi' | 'name'): string {
    switch (type) {
      case 'imo':
        return '/vessels/imo';
      case 'mmsi':
        return '/vessels/mmsi';
      case 'name':
        return '/vessels/search';
      default:
        return '/vessels/search';
    }
  }

  /**
   * Get vessel specs endpoint based on identifier type
   */
  private getVesselSpecsEndpoint(type: 'imo' | 'mmsi' | 'name'): string {
    switch (type) {
      case 'imo':
        return '/vessels/imo/specs';
      case 'mmsi':
        return '/vessels/mmsi/specs';
      case 'name':
        return '/vessels/search/specs';
      default:
        return '/vessels/search/specs';
    }
  }

  /**
   * Format vessel information for display
   */
  private formatVesselInfo(vessel: any): string {
    return `Vessel: ${vessel.name || vessel.vesselName || 'N/A'}\n` +
      `IMO: ${vessel.imo || 'N/A'}\n` +
      `MMSI: ${vessel.mmsi || 'N/A'}\n` +
      `Type: ${vessel.vesselType || vessel.type || 'N/A'}\n` +
      `Flag: ${vessel.flag || vessel.country || 'N/A'}`;
  }
}

