import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UniversalTool, InferToolParams } from '../../../universal-agent';
import { createSuccessResponse, createErrorResponse, withExecutionTime } from '../../../universal-agent';
import wikipedia from 'wikipedia';
// @ts-ignore - @tavily/core types
import * as tavilyModule from '@tavily/core';
const tavily = (tavilyModule as any).tavily || tavilyModule;
// @ts-ignore - zod is a peer dependency
import { z } from 'zod';
import axios from 'axios';

/**
 * Web Search Tools Registry
 * Provides web search, Wikipedia, and weather tools
 */
@Injectable()
export class WebSearchToolsRegistry {
  private readonly logger = new Logger(WebSearchToolsRegistry.name);
  private tavilyClient: ReturnType<typeof tavily> | null = null;

  constructor(private readonly configService: ConfigService) {
    // Initialize Tavily client if API key is available
    const tavilyApiKey = this.configService.get<string>('TAVILY_API_KEY');
    if (tavilyApiKey) {
      this.tavilyClient = tavily({ apiKey: tavilyApiKey });
    }

    // Configure Wikipedia API with user agent to avoid 403 errors
    // Wikipedia API requires a proper user agent to identify the application
    // As per Wikipedia docs: Set a unique userAgent header that allows us to contact you quickly.
    // Email addresses or URLs of contact pages work well.
    // https://meta.wikimedia.org/wiki/User-Agent_policy
    wikipedia.setLang('en');
    if (typeof axios !== 'undefined' && axios.defaults) {
      axios.defaults.headers.common['User-Agent'] = 'FluctBot/1.0 (contact@fluct.ai)';
    }

  }

  /**
   * Get all web search tools
   */
  getTools(): UniversalTool[] {
    return [
      this.getWebSearchTool(),
      this.getWikipediaSearchTool(),
      this.getWeatherTool(),
    ];
  }

  /**
   * Web search tool using Tavily
   */
  private getWebSearchTool(): UniversalTool {
    const paramsSchema = z.object({
      query: z.string().describe('The search query to look up on the web'),
      maxResults: z.number().optional().default(5).describe('Maximum number of results to return (default: 5)'),
    });

    return {
      name: 'web_search',
      description: 'Search the web for current information using Tavily search API. Use this when the user asks about current events, news, or information that requires up-to-date web data.',
      parameters: paramsSchema,
      execute: async (params: InferToolParams<typeof paramsSchema>) => {
        this.logger.log(`[Tool: web_search] Called with query: "${params.query}", maxResults: ${params.maxResults || 5}`);
        try {
          if (!this.tavilyClient) {
            throw new Error('TAVILY_API_KEY not configured. Please set it in environment variables.');
          }

          this.logger.debug(`[Tool: web_search] Executing Tavily search...`);
          const response = await this.tavilyClient.search(params.query, {
            searchDepth: 'basic',
            includeAnswer: true,
            includeImages: false,
            includeRawContent: false,
            maxResults: params.maxResults || 5,
          });

          const results = response.results || [];
          const answer = response.answer;

          let resultText = '';
          if (answer) {
            resultText += `Answer: ${answer}\n\n`;
          }

          if (results.length > 0) {
            resultText += 'Sources:\n';
            results.forEach((result: any, index: number) => {
              resultText += `${index + 1}. ${result.title}\n`;
              resultText += `   URL: ${result.url}\n`;
              if (result.content) {
                resultText += `   ${result.content.substring(0, 200)}...\n`;
              }
              resultText += '\n';
            });
          } else {
            resultText += 'No results found.';
          }

          const result = {
            success: true,
            query: params.query,
            answer: answer || null,
            results: results.map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.content,
            })),
            summary: resultText,
          };
          this.logger.log(`[Tool: web_search] Executed successfully. Found ${results.length} results`);
          return result;
        } catch (error) {
          this.logger.error(`[Tool: web_search] Error: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Failed to search the web: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
    };
  }

  /**
   * Wikipedia search tool
   */
  private getWikipediaSearchTool(): UniversalTool {
    const paramsSchema = z.object({
      query: z.string().describe('The topic or query to search on Wikipedia'),
      maxResults: z.number().optional().default(3).describe('Maximum number of results to return (default: 3)'),
    });

    return {
      name: 'wikipedia_search',
      description: 'Search Wikipedia for information about a topic. Use this when the user asks about general knowledge, historical facts, or information that might be on Wikipedia.',
      parameters: paramsSchema,
      execute: async (params: InferToolParams<typeof paramsSchema>) => {
        this.logger.log(`[Tool: wikipedia_search] Called with query: "${params.query}", maxResults: ${params.maxResults || 3}`);
        try {
          // Try to get page directly first
          try {
            this.logger.debug(`[Tool: wikipedia_search] Attempting direct page lookup...`);
            const page = await wikipedia.page(params.query);
            const summary = await page.summary();
            const url = page.fullurl;

            const result = {
              success: true,
              query: params.query,
              title: summary.title,
              extract: summary.extract,
              url: url,
              summary: `Title: ${summary.title}\n\n${summary.extract}\n\nURL: ${url}`,
            };
            this.logger.log(`[Tool: wikipedia_search] Executed successfully. Found direct page: "${summary.title}"`);
            return result;
          } catch (pageError) {
            // If direct page not found, try search
            this.logger.debug(`[Tool: wikipedia_search] Direct page not found for "${params.query}", trying search`);
          }

          // Search for pages
          this.logger.debug(`[Tool: wikipedia_search] Executing Wikipedia search...`);
          const searchResults = await wikipedia.search(params.query, {
            limit: params.maxResults || 3,
            suggestion: true,
          });

          if (!searchResults.results || searchResults.results.length === 0) {
            return {
              success: false,
              message: `No Wikipedia articles found for "${params.query}"`,
            };
          }

          // Get summaries for search results
          const results = await Promise.all(
            searchResults.results.slice(0, params.maxResults || 3).map(async (title: string) => {
              try {
                const page = await wikipedia.page(title);
                const summary = await page.summary();
                return {
                  title: summary.title,
                  extract: summary.extract,
                  url: page.fullurl,
                };
              } catch (error) {
                this.logger.warn(`Failed to get page for "${title}": ${error}`);
                return {
                  title: title,
                  extract: 'Unable to fetch content',
                  url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
                };
              }
            }),
          );

          let summary = 'Wikipedia Results:\n\n';
          results.forEach((result: any, index: number) => {
            summary += `${index + 1}. ${result.title}\n`;
            summary += `   ${result.extract.substring(0, 300)}${result.extract.length > 300 ? '...' : ''}\n`;
            summary += `   URL: ${result.url}\n\n`;
          });

          const result = {
            success: true,
            query: params.query,
            results,
            summary,
          };
          this.logger.log(`[Tool: wikipedia_search] Executed successfully. Found ${results.length} results`);
          return result;
        } catch (error) {
          this.logger.error(`[Tool: wikipedia_search] Error: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Failed to search Wikipedia: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
    };
  }

  /**
   * Weather tool using Open-Meteo API
   */
  private getWeatherTool(): UniversalTool {
    const paramsSchema = z.object({
      latitude: z.number().describe('Latitude coordinate of the location (e.g., 37.7749 for San Francisco)'),
      longitude: z.number().describe('Longitude coordinate of the location (e.g., -122.4194 for San Francisco)'),
    });

    return {
      name: 'get_weather',
      description: 'Get current weather information for a location using latitude and longitude coordinates. Use this when the user asks about weather conditions.',
      parameters: paramsSchema,
      execute: async (params: InferToolParams<typeof paramsSchema>) => {
        this.logger.log(`[Tool: get_weather] Called with coordinates: lat=${params.latitude}, lon=${params.longitude}`);
        try {
          this.logger.debug(`[Tool: get_weather] Fetching weather data from Open-Meteo API...`);
          const axios = await import('axios');
          const response = await axios.default.get('https://api.open-meteo.com/v1/forecast', {
            params: {
              latitude: params.latitude,
              longitude: params.longitude,
              current_weather: true,
            },
            timeout: 10000,
          });

          const data = response.data;
          const currentWeather = data.current_weather;

          if (!currentWeather) {
            throw new Error('Weather data not available');
          }

          const weatherInfo = {
            temperature: currentWeather.temperature,
            windspeed: currentWeather.windspeed,
            winddirection: currentWeather.winddirection,
            weathercode: currentWeather.weathercode,
            time: currentWeather.time,
          };

          // Weather code descriptions (WMO Weather interpretation codes)
          const weatherDescriptions: Record<number, string> = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            56: 'Light freezing drizzle',
            57: 'Dense freezing drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            66: 'Light freezing rain',
            67: 'Heavy freezing rain',
            71: 'Slight snow fall',
            73: 'Moderate snow fall',
            75: 'Heavy snow fall',
            77: 'Snow grains',
            80: 'Slight rain showers',
            81: 'Moderate rain showers',
            82: 'Violent rain showers',
            85: 'Slight snow showers',
            86: 'Heavy snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with slight hail',
            99: 'Thunderstorm with heavy hail',
          };

          const weatherDescription = weatherDescriptions[weatherInfo.weathercode] || 'Unknown';

          const summary = `Weather at ${params.latitude}, ${params.longitude}:\n` +
            `Temperature: ${weatherInfo.temperature}°C\n` +
            `Condition: ${weatherDescription}\n` +
            `Wind Speed: ${weatherInfo.windspeed} km/h\n` +
            `Wind Direction: ${weatherInfo.winddirection}°\n` +
            `Time: ${weatherInfo.time}`;

          const result = {
            success: true,
            location: {
              latitude: params.latitude,
              longitude: params.longitude,
            },
            weather: weatherInfo,
            description: weatherDescription,
            summary,
          };
          this.logger.log(`[Tool: get_weather] Executed successfully. Temperature: ${weatherInfo.temperature}°C, Condition: ${weatherDescription}`);
          return result;
        } catch (error) {
          this.logger.error(`[Tool: get_weather] Error: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error(`Failed to get weather: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
    };
  }
}

