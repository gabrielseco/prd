#!/usr/bin/env bun
import { Octokit } from "@octokit/rest";
import Anthropic from "@anthropic-ai/sdk";

interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
}

interface CompareDetails {
  owner: string;
  repo: string;
  base: string;
  head: string;
}

type URLDetails =
  | { type: "pr"; details: PRDetails }
  | { type: "compare"; details: CompareDetails };

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface PRData {
  title: string;
  body?: string | null;
  html_url: string;
}

interface GeneratedContent {
  title: string;
  description: string;
}

function parseGitHubUrl(url: string): URLDetails {
  if (!url || typeof url !== "string") {
    throw new Error("GitHub URL is required and must be a string");
  }

  // Try to parse as PR URL first
  const prRegex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const prMatch = url.match(prRegex);

  if (prMatch) {
    const [, owner, repo, pullNumberStr] = prMatch;

    if (!owner || !repo || !pullNumberStr) {
      throw new Error("Failed to extract owner, repo, or pull number from URL");
    }

    const pull_number = parseInt(pullNumberStr, 10);
    if (isNaN(pull_number) || pull_number <= 0) {
      throw new Error("Invalid pull number in URL");
    }

    return {
      type: "pr",
      details: { owner, repo, pull_number },
    };
  }

  // Try to parse as compare URL
  const compareRegex = /github\.com\/([^\/]+)\/([^\/]+)\/compare\/([^?#]+)/;
  const compareMatch = url.match(compareRegex);

  if (compareMatch) {
    const [, owner, repo, comparison] = compareMatch;

    if (!owner || !repo || !comparison) {
      throw new Error("Failed to extract owner, repo, or comparison from URL");
    }

    // comparison can be "base...head" or just "branch-name"
    const parts = comparison.split("...");
    let base: string | undefined;
    let head: string | undefined;

    if (parts.length === 2) {
      base = parts[0];
      head = parts[1];
    } else if (parts.length === 1) {
      // If only one branch is provided, assume comparing to default branch
      base = "main"; // GitHub will resolve this
      head = parts[0];
    } else {
      throw new Error("Invalid comparison format in URL");
    }

    return {
      type: "compare",
      details: { owner, repo, base: base ?? "", head: head ?? ("" as string) },
    };
  }

  throw new Error(
    "Invalid GitHub URL. Expected format: https://github.com/owner/repo/pull/123 or https://github.com/owner/repo/compare/base...head"
  );
}

async function fetchPRChanges(octokit: Octokit, details: PRDetails) {
  const { data: pr } = await octokit.pulls.get({
    owner: details.owner,
    repo: details.repo,
    pull_number: details.pull_number,
  });

  const { data: files } = await octokit.pulls.listFiles({
    owner: details.owner,
    repo: details.repo,
    pull_number: details.pull_number,
  });

  return { pr, files };
}

async function fetchCompareChanges(octokit: Octokit, details: CompareDetails) {
  const { data: comparison } = await octokit.repos.compareCommitsWithBasehead({
    owner: details.owner,
    repo: details.repo,
    basehead: `${details.base}...${details.head}`,
  });

  return { comparison };
}

async function generateTitleAndDescription(
  anthropic: Anthropic,
  files: FileChange[],
  context?: {
    currentTitle?: string;
    currentBody?: string | null;
    base?: string;
    head?: string;
  }
) {
  const filesChanged = files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
    patch: f.patch?.substring(0, 1000), // Limit patch size
  }));

  const contextInfo = context
    ? `
${context.currentTitle ? `Current Title: ${context.currentTitle}` : ""}
${context.currentBody ? `Current Description: ${context.currentBody}` : ""}
${
  context.base && context.head
    ? `Comparing: ${context.base}...${context.head}`
    : ""
}
`
    : "";

  const prompt = `Analyze these GitHub changes and generate a clear, concise PR title and description.
${contextInfo}
Files Changed (${files.length} files):
${JSON.stringify(filesChanged, null, 2)}

Please generate:
1. A PR title following the Conventional Commits format:
   - Format: <type>(<scope>): <description>
   - Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
   - Scope: optional, the area of the codebase affected
   - Description: brief summary in imperative mood, lowercase, no period at the end
   - Example: "feat(auth): add OAuth2 login support"
   - Example: "fix(api): resolve null pointer exception in user endpoint"

2. A well-structured PR description that includes:
   - A brief summary of what this PR does
   - Key changes made
   - Any notable technical details

Format your response as JSON with this exact structure:
{
  "title": "type(scope): description following conventional commits",
  "description": "Your PR description in markdown format here"
}

Keep it concise and professional.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content && content.type === "text") {
    // Parse the JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as GeneratedContent;
      return parsed;
    }
    throw new Error("Could not parse JSON response from Claude");
  }

  throw new Error("Unexpected response format from Anthropic API");
}

async function updatePRDescription(
  octokit: Octokit,
  details: PRDetails,
  description: string
) {
  await octokit.pulls.update({
    owner: details.owner,
    repo: details.repo,
    pull_number: details.pull_number,
    body: description,
  });
}

async function main() {
  const args: string[] = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: prd <GITHUB_URL>

Supports two types of URLs:
  1. Pull Request URL: https://github.com/owner/repo/pull/123
  2. Compare URL: https://github.com/owner/repo/compare/base...head

Environment variables required:
  GITHUB_PRD_TOKEN      - GitHub personal access token
  ANTHROPIC_API_KEY - Anthropic API key

Examples:
  export GITHUB_PRD_TOKEN="ghp_..."
  export ANTHROPIC_API_KEY="sk-ant-..."

  # Update existing PR
  prd https://github.com/owner/repo/pull/123

  # Generate title and description from compare link
  prd https://github.com/owner/repo/compare/main...feature-branch
    `);
    process.exit(0);
  }

  const githubUrl = args[0];
  const githubToken = process.env.GITHUB_PRD_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!githubToken) {
    console.error("Error: GITHUB_PRD_TOKEN environment variable is required");
    process.exit(1);
  }

  if (!anthropicKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!githubUrl) {
    console.error("Error: GitHub URL is required");
    process.exit(1);
  }

  try {
    console.log("🔍 Parsing GitHub URL...");
    const urlDetails = parseGitHubUrl(githubUrl);

    const octokit = new Octokit({ auth: githubToken });
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    if (urlDetails.type === "pr") {
      // Existing PR workflow
      const prDetails = urlDetails.details;
      console.log(`   Type: Pull Request`);
      console.log(`   Owner: ${prDetails.owner}`);
      console.log(`   Repo: ${prDetails.repo}`);
      console.log(`   PR #: ${prDetails.pull_number}`);

      console.log("\n📥 Fetching PR changes...");
      const { pr, files } = await fetchPRChanges(octokit, prDetails);
      console.log(`   Found ${files.length} changed files`);

      console.log("\n🤖 Generating title and description with Claude...");
      const generated = await generateTitleAndDescription(anthropic, files, {
        currentTitle: pr.title,
        currentBody: pr.body,
      });

      console.log("\n📝 Generated Content:");
      console.log("─".repeat(80));
      console.log(`Title: ${generated.title}`);
      console.log("\nDescription:");
      console.log(generated.description);
      console.log("─".repeat(80));

      console.log("\n💡 Suggested title:");
      console.log(`   ${generated.title}`);
      console.log(`   Current title: ${pr.title}`);

      console.log("\n✍️  Updating PR description...");
      await updatePRDescription(octokit, prDetails, generated.description);

      console.log("✅ Successfully updated PR description!");
      console.log(`   View at: ${pr.html_url}`);
      console.log(
        "\n💭 Note: Title was not automatically updated. You can update it manually if desired."
      );
    } else {
      // Compare URL workflow
      const compareDetails = urlDetails.details;
      console.log(`   Type: Compare`);
      console.log(`   Owner: ${compareDetails.owner}`);
      console.log(`   Repo: ${compareDetails.repo}`);
      console.log(
        `   Comparing: ${compareDetails.base}...${compareDetails.head}`
      );

      console.log("\n📥 Fetching comparison changes...");
      const { comparison } = await fetchCompareChanges(octokit, compareDetails);
      console.log(`   Found ${comparison.files?.length || 0} changed files`);

      if (!comparison.files || comparison.files.length === 0) {
        console.log("\n⚠️  No file changes found in this comparison.");
        process.exit(0);
      }

      console.log("\n🤖 Generating title and description with Claude...");
      const generated = await generateTitleAndDescription(
        anthropic,
        comparison.files as FileChange[],
        { base: compareDetails.base, head: compareDetails.head }
      );

      console.log("\n📝 Generated PR Content:");
      console.log("─".repeat(80));
      console.log(`Title:\n${generated.title}`);
      console.log("\nDescription:");
      console.log(generated.description);
      console.log("─".repeat(80));

      console.log("\n✅ Generated title and description!");
      console.log("\n💡 Use these when creating your PR:");
      console.log(
        `   Compare URL: https://github.com/${compareDetails.owner}/${compareDetails.repo}/compare/${compareDetails.base}...${compareDetails.head}`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
    } else {
      console.error("\n❌ An unknown error occurred");
    }
    process.exit(1);
  }
}

main();
