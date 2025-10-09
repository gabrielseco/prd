# rogal

A CLI tool to automatically generate and update GitHub PR descriptions using Claude AI.

## Features

- Fetches PR details and file changes from GitHub
- Analyzes changes using Anthropic's Claude API
- Generates comprehensive PR descriptions
- Automatically updates the PR with the generated description

## Installation

```bash
bun install
```

## Setup

1. Create a `.env` file from the example:
```bash
cp .env.example .env
```

2. Add your credentials to `.env`:
   - `GITHUB_TOKEN`: Create a personal access token at https://github.com/settings/tokens (needs `repo` scope)
   - `ANTHROPIC_API_KEY`: Get your API key from https://console.anthropic.com/

## Usage

```bash
# Set environment variables
export GITHUB_TOKEN="ghp_your_token_here"
export ANTHROPIC_API_KEY="sk-ant-your_key_here"

# Run the CLI
prd https://github.com/owner/repo/pull/123
```

## How it works

1. Parses the GitHub PR URL
2. Fetches PR details and changed files via GitHub API
3. Sends file changes to Claude for analysis
4. Generates a structured description with:
   - Summary of changes
   - Key modifications
   - Technical details
5. Updates the PR description on GitHub

## Example

```bash
prd https://github.com/anthropics/anthropic-sdk-typescript/pull/456
```

Output:
```
🔍 Parsing PR URL...
   Owner: anthropics
   Repo: anthropic-sdk-typescript
   PR #: 456

📥 Fetching PR changes...
   Found 5 changed files

🤖 Generating description with Claude...

📝 Generated Description:
────────────────────────────────────────────────────────────────────────────────
[Generated markdown description here]
────────────────────────────────────────────────────────────────────────────────

✍️  Updating PR description...
✅ Successfully updated PR description!
   View at: https://github.com/anthropics/anthropic-sdk-typescript/pull/456
```

## Requirements

- Bun v1.2+
- GitHub personal access token with `repo` scope
- Anthropic API key

## License

Private project
