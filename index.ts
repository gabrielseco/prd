#!/usr/bin/env bun
import { Octokit } from "@octokit/rest";
import Anthropic from "@anthropic-ai/sdk";

interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
}

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

function parsePRUrl(url: string): PRDetails {
  if (!url || typeof url !== "string") {
    throw new Error("PR URL is required and must be a string");
  }

  const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const match = url.match(regex);

  if (!match) {
    throw new Error(
      "Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123"
    );
  }

  const [, owner, repo, pullNumberStr] = match;

  if (!owner || !repo || !pullNumberStr) {
    throw new Error("Failed to extract owner, repo, or pull number from URL");
  }

  const pull_number = parseInt(pullNumberStr, 10);
  if (isNaN(pull_number) || pull_number <= 0) {
    throw new Error("Invalid pull number in URL");
  }

  return {
    owner,
    repo,
    pull_number,
  };
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

async function generateDescription(
  anthropic: Anthropic,
  pr: PRData,
  files: FileChange[]
) {
  const filesChanged = files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
    patch: f.patch?.substring(0, 1000), // Limit patch size
  }));

  const prompt = `Analyze this GitHub Pull Request and generate a clear, concise description.

PR Title: ${pr.title}
${pr.body ? `Current Description: ${pr.body}` : ""}

Files Changed (${files.length} files):
${JSON.stringify(filesChanged, null, 2)}

Please generate a well-structured PR description that includes:
1. A brief summary of what this PR does
2. Key changes made
3. Any notable technical details

Keep it concise and professional. Format in markdown.`;

  const message = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content && content.type === "text") {
    return content.text;
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
Usage: prd <PR_URL>

Environment variables required:
  GITHUB_TOKEN      - GitHub personal access token
  ANTHROPIC_API_KEY - Anthropic API key

Example:
  export GITHUB_TOKEN="ghp_..."
  export ANTHROPIC_API_KEY="sk-ant-..."
  bun run index.ts https://github.com/owner/repo/pull/123
    `);
    process.exit(0);
  }

  const prUrl = args[0];
  const githubToken = process.env.GITHUB_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!githubToken) {
    console.error("Error: GITHUB_TOKEN environment variable is required");
    process.exit(1);
  }

  if (!anthropicKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!prUrl) {
    console.error("Error: PR URL is required");
    process.exit(1);
  }

  try {
    console.log("🔍 Parsing PR URL...");
    const prDetails = parsePRUrl(prUrl);
    console.log(`   Owner: ${prDetails.owner}`);
    console.log(`   Repo: ${prDetails.repo}`);
    console.log(`   PR #: ${prDetails.pull_number}`);

    const octokit = new Octokit({ auth: githubToken });
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    console.log("\n📥 Fetching PR changes...");
    const { pr, files } = await fetchPRChanges(octokit, prDetails);
    console.log(`   Found ${files.length} changed files`);

    console.log("\n🤖 Generating description with Claude...");
    const description = await generateDescription(anthropic, pr, files);

    console.log("\n📝 Generated Description:");
    console.log("─".repeat(80));
    console.log(description);
    console.log("─".repeat(80));

    console.log("\n✍️  Updating PR description...");
    await updatePRDescription(octokit, prDetails, description);

    console.log("✅ Successfully updated PR description!");
    console.log(`   View at: ${pr.html_url}`);
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
