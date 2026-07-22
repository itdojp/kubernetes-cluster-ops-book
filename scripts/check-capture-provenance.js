#!/usr/bin/env node
/* Online CI gate for the immutable GitHub Actions capture attestation. */
const fs = require('fs');
const path = require('path');

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
  console.error('Capture provenance check requires GITHUB_TOKEN or GH_TOKEN.');
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/assets/visual-evidence/manifest.json'), 'utf8'));
const attestation = manifest.captureAttestation;
const apiBase = `https://api.github.com/repos/${attestation.repository}`;

async function githubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kubernetes-cluster-ops-book-capture-provenance',
    },
  });
  if (response.status === 404) {
    throw new Error(
      `GitHub API 404 for ${new URL(url).pathname}; the attested capture run or source is no longer available. `
      + 'Re-run the isolated capture workflow and update the manifest captureAttestation before merging.',
    );
  }
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${new URL(url).pathname}`);
  return response.json();
}
function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  const run = await githubJson(`${apiBase}/actions/runs/${attestation.runId}`);
  for (const [field, value] of Object.entries({
    id: attestation.runId, name: attestation.workflowName, path: attestation.workflowPath,
    event: attestation.event, head_branch: attestation.headBranch, head_sha: attestation.headSha,
    run_attempt: attestation.runAttempt, status: attestation.status, conclusion: attestation.conclusion,
  })) requireEqual(run[field], value, `capture run ${field}`);
  requireEqual(run.repository?.full_name, attestation.repository, 'capture run repository');
  requireEqual(run.html_url, attestation.runUrl, 'capture run URL');

  const commit = await githubJson(`${apiBase}/commits/${attestation.headSha}`);
  requireEqual(commit.sha, attestation.headSha, 'capture head commit');
  for (const [filePath, expectedSha] of [
    [attestation.workflowPath, attestation.captureWorkflowBlobSha],
    [attestation.captureScriptPath, attestation.captureScriptBlobSha],
  ]) {
    const content = await githubJson(`${apiBase}/contents/${filePath}?ref=${attestation.headSha}`);
    requireEqual(content.sha, expectedSha, `capture source blob ${filePath}`);
  }

  const jobs = await githubJson(`${apiBase}/actions/runs/${attestation.runId}/jobs?per_page=100`);
  const matchingJobs = jobs.jobs.filter((job) => job.name === attestation.jobName);
  requireEqual(matchingJobs.length, 1, 'capture job count');
  requireEqual(matchingJobs[0].status, 'completed', 'capture job status');
  requireEqual(matchingJobs[0].conclusion, 'success', 'capture job conclusion');
  for (const stepName of attestation.requiredSuccessfulSteps) {
    const steps = matchingJobs[0].steps.filter((step) => step.name === stepName);
    requireEqual(steps.length, 1, `capture step count ${stepName}`);
    requireEqual(steps[0].conclusion, 'success', `capture step conclusion ${stepName}`);
  }

  if (!/^[0-9a-f]{64}$/.test(attestation.artifactSha256) || attestation.artifactDigestSource !== 'actions/upload-artifact@v7 run log') {
    throw new Error('capture artifact digest attestation is incomplete');
  }
  const artifacts = await githubJson(`${apiBase}/actions/runs/${attestation.runId}/artifacts?per_page=100`);
  requireEqual(attestation.artifactDeletedAfterVerification, true, 'artifact cleanup attestation');
  requireEqual(artifacts.total_count, 0, 'post-verification artifact cleanup');
  console.log(`Capture provenance verified: run ${attestation.runId}, immutable source ${attestation.headSha.slice(0, 12)}, successful job/steps, artifact digest attested, cleanup complete.`);
}

main().catch((error) => { console.error(`Capture provenance check failed: ${error.message}`); process.exit(1); });
