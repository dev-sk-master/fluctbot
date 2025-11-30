import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ExtractedReminderData {
  reminderType: string;
  searchParams: Record<string, any>;
}

/**
 * Service to extract structured reminder data from user queries using LLM
 */
@Injectable()
export class ReminderExtractionService {
  private readonly logger = new Logger(ReminderExtractionService.name);
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize the OpenAI client if not already done
   */
  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('OPENROUTER_API_KEY') || 
                     this.configService.get<string>('OPENAI_API_KEY');

      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY or OPENAI_API_KEY not configured');
      }

      this.client = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': this.configService.get<string>('OPENROUTER_HTTP_REFERER') || 'https://github.com/fluct/fluctbot',
          'X-Title': 'FluctBot',
        },
        timeout: 30 * 1000,
      });
    }
    return this.client;
  }

  /**
   * Extract structured reminder data from user query
   */
  async extractReminderData(
    userQuery: string,
    userId: number,
  ): Promise<ExtractedReminderData> {
    try {
      const client = this.getClient();

      const systemPrompt = `You are a maritime reminder extraction assistant. Extract structured data from user reminder queries.

Your task is to:
1. Identify the reminder type based on the user's intent
2. Extract relevant search parameters (IMO, MMSI, vessel name, port name, fleet references, etc.)

Reminder types:
- vessel_arrival: User wants to be notified when a vessel arrives at a port
- vessel_departure: User wants to be notified when a vessel departs from a port
- port_arrival: User wants to be notified when any vessel arrives at a specific port
- port_departure: User wants to be notified when any vessel departs from a specific port
- vessel_position_change: User wants to be notified when a vessel's position changes significantly
- fleet_update: User wants to be notified about updates to a fleet
- general: Generic reminder that doesn't fit the above categories

Examples:
- "notify me when vessel IMO 9571648 arrives at Dubai port" → reminderType: "vessel_arrival", searchParams: {imo: "9571648", portName: "Dubai"}
- "alert me when my fleet 1 vessels arrive" → reminderType: "fleet_update", searchParams: {fleetIndex: 1}
- "notify when vessel MSC Oscar departs Singapore" → reminderType: "vessel_departure", searchParams: {vesselName: "MSC Oscar", portName: "Singapore"}

Return ONLY valid JSON matching the schema. Do not include any explanatory text.`;

      const userPrompt = `Extract reminder data from this query: "${userQuery}"

Return the result as JSON with this structure:
{
  "reminderType": "vessel_arrival",
  "searchParams": {
    "imo": "9571648",
    "portName": "Dubai"
  }
}`;

      // Use OpenAI client directly with OpenRouter
      let result: ExtractedReminderData;

      try {
        const client = this.getClient();

        // Call OpenAI API via OpenRouter
        const response = await client.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3, // Lower temperature for more consistent extraction
          response_format: { type: 'json_object' }, // Request JSON response
        });

        const content = response.choices[0]?.message?.content;
        
        if (!content) {
          throw new Error('No content in response');
        }

        // Parse JSON response
        try {
          const parsed = JSON.parse(content);
          result = {
            reminderType: parsed.reminderType || 'general',
            searchParams: parsed.searchParams || {},
          };
        } catch (parseError) {
          // Try to extract JSON from text if response_format didn't work
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            result = {
              reminderType: parsed.reminderType || 'general',
              searchParams: parsed.searchParams || {},
            };
          } else {
            throw new Error('No JSON found in response');
          }
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse structured output, using fallback: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        // Fallback: use basic extraction
        result = this.fallbackExtraction(userQuery);
      }

      // Validate and clean the result
      result.reminderType = result.reminderType || 'general';
      result.searchParams = result.searchParams || {};

      this.logger.debug(`Extracted reminder data: ${JSON.stringify(result, null, 2)}`);

      return result;
    } catch (error) {
      this.logger.error(`Error extracting reminder data: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback to basic extraction on error
      return this.fallbackExtraction(userQuery);
    }
  }

  /**
   * Fallback extraction using regex patterns when LLM fails
   */
  private fallbackExtraction(userQuery: string): ExtractedReminderData {
    const query = userQuery.toLowerCase();
    const searchParams: Record<string, any> = {};

    // Extract IMO
    const imoMatch = userQuery.match(/imo\s*:?\s*(\d{7})/i) || userQuery.match(/(\d{7})/);
    if (imoMatch && imoMatch[1].length === 7) {
      searchParams.imo = imoMatch[1];
    }

    // Extract MMSI
    const mmsiMatch = userQuery.match(/mmsi\s*:?\s*(\d{9})/i);
    if (mmsiMatch) {
      searchParams.mmsi = mmsiMatch[1];
    }

    // Extract port names (common ports)
    const commonPorts = ['dubai', 'singapore', 'rotterdam', 'shanghai', 'hong kong', 'los angeles', 'long beach', 'hamburg', 'antwerp'];
    for (const port of commonPorts) {
      if (query.includes(port)) {
        searchParams.portName = port;
        break;
      }
    }

    // Determine reminder type
    let reminderType = 'general';
    if (query.includes('arrive') || query.includes('arrival')) {
      reminderType = searchParams.imo || searchParams.mmsi ? 'vessel_arrival' : 'port_arrival';
    } else if (query.includes('depart') || query.includes('departure') || query.includes('leave')) {
      reminderType = searchParams.imo || searchParams.mmsi ? 'vessel_departure' : 'port_departure';
    } else if (query.includes('position') || query.includes('location')) {
      reminderType = 'vessel_position_change';
    } else if (query.includes('fleet')) {
      reminderType = 'fleet_update';
      const fleetMatch = query.match(/fleet\s*(\d+)/i);
      if (fleetMatch) {
        searchParams.fleetIndex = parseInt(fleetMatch[1], 10);
      }
    }

    if (Object.keys(searchParams).length === 0) {
      searchParams.query = userQuery;
    }

    return {
      reminderType,
      searchParams,
    };
  }
}

