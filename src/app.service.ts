import { Injectable } from "@nestjs/common";
import { PromptDto } from "./app.controller";
import { Language } from "./language";
import { PrismaService } from "./global-services/prisma.service";
import { ConfigService } from "@nestjs/config";
import { EmbeddingsService } from "./modules/embeddings/embeddings.service";
import { CustomLogger } from "./common/logger";
import { PromptHistoryService } from "./modules/prompt-history/prompt-history.service";
const fetch = require('node-fetch'); 
const { Headers } = fetch;

// Overlap between LangchainAI and Prompt-Engine
export interface Prompt {
  input: PromptDto;
  output?: string;
  inputLanguage?: Language;
  inputTextInEnglish?: string;
  maxTokens?: number;
  outputLanguage?: Language;
  similarDocs?: any;

  // More output metadata
  timeTaken?: number;
  timestamp?: number;
  responseType?: string;
}

export interface Document {
  combined_content: string;
  combined_prompt: string;
}

export interface ResponseForTS {
  message: {
    title: string;
    choices: string[];
    media_url: string;
    caption: string;
    msg_type: string;
    conversationId: string;
  };
  to: string;
  messageId: string;
}

@Injectable()
export class AppService {
  private logger: CustomLogger;
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private embeddingsService: EmbeddingsService,
    private promptHistoryService: PromptHistoryService
  ) {
    this.logger = new CustomLogger("AppService");
  }
  getHello(): string {
    return "Hello World!";
  }

  async getHealth(minutes: number): Promise<any> {
    const startTime = new Date(Date.now() - minutes * 60 * 1000);
    const queries = await this.prisma.query.findMany({
      where: {
        createdAt: {
          gte: startTime,
        },
      },
      select: {
        errorRate: true,
      },
    });
    const totalQueries = queries.length;
    const totalErrorRate = queries.reduce(
      (sum, query) => sum + query.errorRate,
      0
    );
    console.log(totalErrorRate,totalQueries)
    const averageErrorRate = totalErrorRate / totalQueries;
    const response = {
      status: (averageErrorRate || 0) > (this.configService.get("ERROR_RATE_THRESHOLD")) ? "SERVER DOWN" : "OK",
      averageErrorRate: averageErrorRate || 0,
      timeFrame: `${minutes} minutes`,
      version: this.configService.get("SERVER_RELEASE_VERSION")?.slice(0.7)
    };
    return response
  }

  async createOrUpdateConfig(body){
    try {
      let {key,value,metaData} = body;
      // Check if the config with the provided key already exists
      const existingConfig = await this.prisma.config.findUnique({ where: { key } });
  
      if (existingConfig) {
        // If config exists, update its value
        const updatedConfig = await this.prisma.config.update({
          where: { key },
          data: { value, metaData },
        });
  
        return updatedConfig;
      } else {
        // If config does not exist, create a new one
        const newConfig = await this.prisma.config.create({
          data: { key, value, metaData },
        });
  
        return newConfig;
      }
    } catch (error) {
      console.error('Error occurred:', error);
      return { error: 'An error occurred while processing the request.' };
    }
  }
}
