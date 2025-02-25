# AI Vision Batch Processor

This command-line tool processes a batch of PNG images and sends them to an AI vision model (OpenAI or Google Gemini) to transcribe or analyze their content. The motivation is to avoid manually copying images and prompts into ChatGPT or other tools, especially when there are many pages to process. There may be similar tools out there—if you find a better one, let me know I will gladly switch to using that!

## How to Transcribe a Batch Set of Images

1. Make sure [Deno](https://deno.land/) is installed.
2. Prepare a folder with images you want to process. **Supported formats**: PNG, JPG, JPEG, WEBP, and BMP.
3. Have an OpenAI API key ready.

> Permissions are restricted to reading from `./images`, writing to the current directory, accessing environment variables, and making network calls only to `api.openai.com`. Thanks to Deno's cool permissions model!

```bash
export OPENAI_API_KEY=<your-openai-api-key>
deno run \
  --allow-read="./images" \
  --allow-write="./" \
  --allow-env \
  --allow-net=api.openai.com \
  https://raw.githubusercontent.com/bra1nDump/llm-batch-image-transcription/main/main.ts \
  ./images --output output.md --provider openai --model gpt-4o \
  --prompt-file default_prompt.txt
```



## Features

- Supports multiple AI providers:
  - **OpenAI** (GPT-4 Vision)
  - **Google Gemini Vision**
- Smart image preprocessing:
  - Automatic resizing (768px on the short side, up to 2000px on the long side)
  - JPEG compression with size checks
- Flexible output formatting:
  - Configurable separators or headers for each image
  - Insert detail headers, custom text, or no separator
- Debugging support:
  - Save preprocessed images for verification
  - Detailed logging and progress updates
- Batch controls:
  - Process entire folders or limit to N images
  - Sort images by filename for consistent ordering

## Setup

1. Clone the repository or download it from [GitHub](https://github.com/bra1nDump/llm-batch-image-transcription).  
2. Copy `.env.example` to `.env`.  
3. Add your OpenAI or Gemini API keys to `.env`:
   ```bash
   OPENAI_API_KEY=<your-api-key>
   GEMINI_API_KEY=<your-gemini-api-key>
   ```
4. (Optional) Create or modify a prompt file to guide the AI for your images.

## Example Commands

**Basic Transcription (OpenAI):**  
```bash
deno run --allow-read --allow-write --allow-env --allow-net main.ts \
  /path/to/image/folder \
  --output output.md \
  --provider openai \
  --prompt-file default_prompt.txt
```

**Detailed Headers (Gemini):**  
```bash
deno run --allow-read --allow-write --allow-env --allow-net main.ts \
  /path/to/image/folder \
  --output gemini-output.md \
  --provider gemini \
  --separator-header detailed \
  --model gemini-pro-vision \
  --prompt "Describe the content of this image in detail"
```

## Testing

If you want to run tests (for example, using local test data):
```bash
deno test --allow-read --allow-write --allow-env --allow-net
```

## Output Format

The tool produces a markdown file with each image's transcription appended. In "detailed" mode, each image is prefixed with a markdown header (like `## filename.png`), followed by the AI-generated text.

```markdown
## image1.png

[Transcribed text from image1]

## image2.png

[Transcribed text from image2]
```

##
Feel free to open an issue or PR at the [project repo](https://github.com/bra1nDump/llm-batch-image-transcription) if you have improvements or ideas!