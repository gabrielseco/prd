# rogal

A CLI tool to automatically generate GitHub PR titles and descriptions using Claude AI.

## Features

- Supports both existing PRs and compare URLs
- Generates PR titles following Conventional Commits format
- Analyzes changes using Anthropic's Claude API
- Generates comprehensive PR descriptions
- Automatically updates existing PR descriptions
- Suggests improved titles for existing PRs

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
   - `GITHUB_PRD_TOKEN`: Create a personal access token at https://github.com/settings/tokens (needs `repo` scope)
   - `ANTHROPIC_API_KEY`: Get your API key from https://console.anthropic.com/

## Usage

```bash
# Set environment variables
export GITHUB_PRD_TOKEN="ghp_your_token_here"
export ANTHROPIC_API_KEY="sk-ant-your_key_here"

# Update existing PR with generated description and get title suggestion
prd https://github.com/owner/repo/pull/123

# Generate title and description from compare link (before creating PR)
prd https://github.com/owner/repo/compare/main...feature-branch
```

## How it works

### For existing PRs
1. Parses the GitHub PR URL
2. Fetches PR details and changed files via GitHub API
3. Sends file changes to Claude for analysis
4. Generates a conventional commit title and structured description
5. Updates the PR description on GitHub
6. Displays a suggested title for manual update

### For compare URLs
1. Parses the GitHub compare URL
2. Fetches comparison data and changed files via GitHub API
3. Sends file changes to Claude for analysis
4. Generates a conventional commit title and structured description
5. Displays both for you to use when creating the PR

## Examples

### Updating an existing PR

```bash
prd https://github.com/owner/repo/pull/456
```

Output:

```
🔍 Parsing GitHub URL...
   Type: Pull Request
   Owner: owner
   Repo: repo
   PR #: 456

📥 Fetching PR changes...
   Found 5 changed files

🤖 Generating title and description with Claude...

📝 Generated Content:
────────────────────────────────────────────────────────────────────────────────
Title: feat(auth): add OAuth2 login support

Description:
## Summary
This PR adds OAuth2 authentication support to enable users to log in...
[Generated markdown description here]
────────────────────────────────────────────────────────────────────────────────

💡 Suggested title:
   feat(auth): add OAuth2 login support
   Current title: Add OAuth login

✍️  Updating PR description...
✅ Successfully updated PR description!
   View at: https://github.com/owner/repo/pull/456

💭 Note: Title was not automatically updated. You can update it manually if desired.
```

### Generating content from compare URL

```bash
prd https://github.com/owner/repo/compare/main...feature-branch
```

Output:

```
🔍 Parsing GitHub URL...
   Type: Compare
   Owner: owner
   Repo: repo
   Comparing: main...feature-branch

📥 Fetching comparison changes...
   Found 8 changed files

🤖 Generating title and description with Claude...

📝 Generated PR Content:
────────────────────────────────────────────────────────────────────────────────
Title:
refactor(api): migrate to new error handling system

Description:
## Summary
This PR refactors the API layer to use a centralized error handling...
[Generated markdown description here]
────────────────────────────────────────────────────────────────────────────────

✅ Generated title and description!

💡 Use these when creating your PR:
   Compare URL: https://github.com/owner/repo/compare/main...feature-branch
```

## Requirements

- Bun v1.2+
- GitHub personal access token with `repo` scope
- Anthropic API key

## License

Private project
