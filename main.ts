import { command, number, option, positional, run, string } from 'cmd-ts';
import OpenAI from 'openai';
import { GenerativeModel, GoogleGenerativeAI } from 'npm:@google/generative-ai';
import { config as loadEnv } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';
import { ensureDir } from 'https://deno.land/std@0.208.0/fs/ensure_dir.ts';
import { encodeBase64 } from 'https://deno.land/std@0.208.0/encoding/base64.ts';

// Load environment variables from .env file
await loadEnv({ export: true });

interface VisionProvider {
  transcribeImage(base64Image: string, prompt: string): Promise<string>;
}

class OpenAIVisionProvider implements VisionProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4-vision-preview') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async transcribeImage(base64Image: string, prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      // Thinking models use max_completion_tokens, other models use max_tokens
      ...(this.model.startsWith('o') ? { max_completion_tokens: 20000 } : { max_tokens: 20000 }),
    });

    return response.choices[0].message.content || '';
  }
}

class GeminiVisionProvider implements VisionProvider {
  private model: GenerativeModel;

  constructor(apiKey: string, modelName: string = 'gemini-pro-vision') {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  async transcribeImage(base64Image: string, prompt: string): Promise<string> {
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: 'image/jpeg',
      },
    };

    try {
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error details:', error);
      throw error;
    }
  }
}

// Factory function to create provider based on configuration
function createVisionProvider(provider: 'openai' | 'gemini', model?: string): VisionProvider {
  switch (provider.toLowerCase()) {
    case 'openai': {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
      }
      return new OpenAIVisionProvider(openaiKey, model);
    }

    case 'gemini': {
      if (!GoogleGenerativeAI) {
        throw new Error(
          'Gemini AI package is not available. Please install @google/generative-ai package.',
        );
      }
      const geminiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required for Gemini provider');
      }
      return new GeminiVisionProvider(geminiKey, model);
    }

    default: {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}

async function preprocessImage(imagePath: string, debugOutputDir?: string): Promise<Uint8Array> {
  const imageData = await Deno.readFile(imagePath);
  const image = await Image.decode(imageData);

  // Calculate target dimensions for high-res mode
  // Short side should be 768px, long side max 2000px
  const aspectRatio = image.width / image.height;
  let targetWidth: number;
  let targetHeight: number;

  console.log(`\nImage preprocessing details for ${imagePath}:`);
  console.log(
    `Original dimensions: ${image.width}x${image.height} (aspect ratio: ${aspectRatio.toFixed(2)})`,
  );

  if (aspectRatio >= 1) {
    // Landscape or square
    targetHeight = 768;
    targetWidth = Math.min(Math.round(768 * aspectRatio), 2000);
  } else {
    // Portrait
    targetWidth = 768;
    targetHeight = Math.min(Math.round(768 / aspectRatio), 2000);
  }

  console.log(`Target dimensions: ${targetWidth}x${targetHeight}`);
  console.log(`Original size: ${(imageData.length / 1024 / 1024).toFixed(2)}MB`);

  try {
    // Resize the image
    await image.resize(targetWidth, targetHeight);

    // Convert to JPEG format with high quality
    const processedData = await image.encodeJPEG(90);
    console.log(`Processed size: ${(processedData.length / 1024 / 1024).toFixed(2)}MB`);

    // Verify the processed data is valid
    const processedSize = processedData.length / 1024 / 1024; // Size in MB
    let finalData = processedData;

    if (processedSize > 20) {
      console.log('Warning: Image size exceeds 20MB, attempting to compress further');
      // Try again with lower quality if size is too large
      finalData = await image.encodeJPEG(70);
      console.log(`Recompressed size: ${(finalData.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Save debug output if requested
    if (debugOutputDir) {
      const fileName = imagePath.split('/').pop() || 'unknown.png';
      const debugFilePath = join(debugOutputDir, fileName.replace(/\.[^/.]+$/, '.jpg'));
      await Deno.writeFile(debugFilePath, finalData);
      console.log(`Debug output saved to: ${debugFilePath}`);
    }

    return finalData;
  } catch (error) {
    console.error(`Error processing image ${imagePath}:`, error);
    throw error;
  }
}

async function readImageAsBase64(imagePath: string, debugOutputDir?: string): Promise<string> {
  const processedImageData = await preprocessImage(imagePath, debugOutputDir);
  return encodeBase64(processedImageData);
}

async function transcribeImage(
  imagePath: string,
  provider: VisionProvider,
  prompt: string,
  debugOutputDir?: string,
): Promise<string> {
  const base64Image = await readImageAsBase64(imagePath, debugOutputDir);
  console.log(`Base64 image size: ${(base64Image.length / 1024 / 1024).toFixed(2)}MB`);
  return await provider.transcribeImage(base64Image, prompt);
}

export async function processImageFolder(
  folderPath: string,
  outputFile: string,
  provider: 'openai' | 'gemini',
  prompt: string,
  separatorHeader: 'detailed' | 'none' | string,
  limit?: number,
  debugOutputDir?: string,
  model?: string,
) {
  try {
    const visionProvider = createVisionProvider(provider, model);

    // Ensure the folder exists
    const folderInfo = await Deno.stat(folderPath);
    if (!folderInfo.isDirectory) {
      throw new Error(`${folderPath} is not a directory`);
    }

    // Create debug output directory if specified
    if (debugOutputDir) {
      await ensureDir(debugOutputDir);
      console.log(`Debug mode enabled. Processed images will be saved to: ${debugOutputDir}`);
    }

    // Get all PNG files in the folder
    const imageFiles: string[] = [];
    for await (const entry of Deno.readDir(folderPath)) {
      if (entry.isFile && entry.name.toLowerCase().endsWith('.png')) {
        imageFiles.push(entry.name);
      }
    }

    // Sort files to ensure consistent processing order
    imageFiles.sort();

    // Apply limit if specified
    const filesToProcess = limit ? imageFiles.slice(0, limit) : imageFiles;
    console.log(`Found ${imageFiles.length} images${limit ? `, processing first ${limit}` : ''}`);

    let fullTranscription = '';
    let processedCount = 0;

    // Process each image
    for (const imageFile of filesToProcess) {
      const imagePath = join(folderPath, imageFile);
      console.log(`\nProcessing image: ${imageFile}`);

      const transcription = await transcribeImage(
        imagePath,
        visionProvider,
        prompt,
        debugOutputDir,
      );

      // Add separator based on the option
      switch (separatorHeader) {
        case 'none': {
          fullTranscription += '\n';
          break;
        }
        case 'detailed': {
          fullTranscription += `\n\n## ${imageFile}\n\n`;
          break;
        }
        default: {
          fullTranscription += `\n\n${separatorHeader}\n\n`;
          break;
        }
      }

      fullTranscription += transcription;

      // Update progress
      processedCount++;
      console.log(`Processed ${processedCount}/${filesToProcess.length} images`);

      // Write intermediate results
      await Deno.writeTextFile(outputFile, fullTranscription.trim());
    }

    console.log(`\nTranscription complete. Output saved to: ${outputFile}`);
    return fullTranscription.trim();
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error processing images: ${error.message}`);
    } else {
      console.error('An unknown error occurred');
    }
    Deno.exit(1);
  }
}

const cmd = command({
  name: 'image-transcribe',
  description: 'Transcribe handwritten text from images using Vision AI',
  version: '1.0.0',
  args: {
    inputFolder: positional({
      type: string,
      displayName: 'input-folder',
      description: 'Input folder containing PNG images',
    }),
    outputFile: option({
      type: string,
      long: 'output',
      description: 'Output markdown file path',
      defaultValue: () => 'transcription.md',
    }),
    provider: option({
      type: string,
      long: 'provider',
      description: 'Vision provider to use (openai or gemini)',
      defaultValue: () => 'openai',
    }),
    prompt: option({
      type: string,
      defaultValue: () => '',
      long: 'prompt',
      description:
        'Direct prompt text to use for transcription (required if --prompt-file is not provided)',
    }),
    promptFile: option({
      type: string,
      long: 'prompt-file',
      defaultValue: () => '',
      description: 'File containing the prompt text (required if --prompt is not provided)',
    }),
    separatorHeader: option({
      type: string,
      long: 'separator-header',
      description: '"detailed" for filename headers, "none" for no separators, or custom text',
      defaultValue: () => 'none',
    }),
    limit: option({
      type: number,
      long: 'first',
      description: 'Process only the first N images',
      defaultValue: () => 0,
    }),
    debugDir: option({
      type: string,
      long: 'debug-dir',
      description: 'Directory to save processed images for debugging',
    }),
    model: option({
      type: string,
      long: 'model',
      description:
        'Specific model to use (e.g., gpt-4-vision-preview for OpenAI or gemini-pro-vision for Gemini)',
      defaultValue: () => '',
    }),
  },
  handler: async (args) => {
    // Validate that at least one prompt option is provided
    if (!args.prompt && !args.promptFile) {
      console.error('Error: Either --prompt or --prompt-file must be provided');
      Deno.exit(1);
    }

    let prompt = args.prompt;

    // If prompt file is provided, read from file (overrides direct prompt)
    if (args.promptFile) {
      try {
        prompt = await Deno.readTextFile(args.promptFile);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`Error reading prompt file: ${error.message}`);
        } else {
          console.error('An unknown error occurred reading the prompt file');
        }
        Deno.exit(1);
      }
    }

    await processImageFolder(
      args.inputFolder,
      args.outputFile,
      args.provider as 'openai' | 'gemini',
      prompt,
      args.separatorHeader,
      args.limit > 0 ? args.limit : undefined,
      args.debugDir,
      args.model || undefined,
    );
  },
});

await run(cmd, Deno.args);
