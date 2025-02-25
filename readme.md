# Handwritten Image Transcription Tool

This tool uses OpenAI's GPT-4 Vision model to transcribe handwritten text from PNG images into a markdown file. It can process multiple images in a folder and combines all transcriptions into a single output file.

## Prerequisites

- Deno runtime
- OpenAI API key

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```

## Usage

Run the tool with a folder containing PNG images:

```bash
deno run --allow-read --allow-write --allow-env --allow-net main.ts /path/to/image/folder --output output.md
```

### Arguments

- First argument: Path to the folder containing PNG images
- `--output`: (Optional) Path to the output markdown file (default: transcription.md)

## Testing

The project includes a test that processes images from the `private-test-data/pages` folder:

```bash
deno test --allow-read --allow-write --allow-env --allow-net
```

## Output Format

The tool generates a markdown file with the following structure:

```markdown
## image1.png

[Transcribed text from image1]

## image2.png

[Transcribed text from image2]

...
```

## Features

- Processes multiple PNG images in a folder
- Preserves formatting and structure of handwritten text
- Marks uncertain words or characters with [?]
- Saves progress incrementally
- Sorts images by filename for consistent processing
- Generates a well-formatted markdown output file