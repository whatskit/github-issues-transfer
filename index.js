#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0

/*
Command-line tool to transfer GitHub issues between repositories

This tool uses the GitHub transfer issue functionality. This functionality is
not part of the public API; that's why this script uses the web UI through a
headless Chrome browser.

See the README.md file for more information on how to get started.
*/

const puppeteer = require('puppeteer')
const settings = require('./settings.json')
const { Octokit } = require('@octokit/rest')
const fs = require('fs').promises

const octokit = new Octokit({ auth: settings.githubToken })

var issueMapping = []

async function writeIssueMappingFile() {
  await fs.writeFile(settings.issueMappingFile, JSON.stringify(issueMapping))
}

async function getSourceIssues() {
  const issueQueryOptions = octokit.issues.listForRepo.endpoint.merge({
    owner: settings.repos.source.owner,
    repo: settings.repos.source.repoName,
    state: "open",
    // Get oldest issues first: they will be transferred first with the smallest
    // issue number in the target repository.
    sort: "created",
    direction: "asc",
    labels: settings.searchLabels.join(',')
  })
  issuesAndPulls = await octokit.paginate(issueQueryOptions)
  return issuesAndPulls.filter(function (entry) {
    return !('pull_request' in entry);
  })
}

async function loginToGithub(page, authinfo) {
  // login
  await page.goto('https://github.com/login')

  await page.waitForSelector('#login_field')
  await page.type('#login_field', authinfo.username)
  await page.type('#password', authinfo.password)
  await page.click('.btn.btn-primary.btn-block')

  // 2FA Token
  /*await page.waitForSelector('#otp')
  await page.focus('#otp')
  await page.type(String(options.token))
  await page.click('.btn.btn-primary.btn-block')*/

  // wait for dashboard to load; it's the end of the login process
  await page.waitForSelector('#dashboard')
}

async function transferIssue(page, sourceIssue, sourceRepoInfo, destRepoInfo) {
  console.log("Transferring issue " + sourceRepoInfo.full_name + "#" + sourceIssue.number + " to " + destRepoInfo.full_name)

  // Initiate issue transfer
  await page.goto(sourceIssue.html_url)
  var destIssueUrl = await page.evaluate(async (sourceIssue, destRepoInfo) => {

    var formData = new FormData(document.querySelector('form[action$="/transfer"]'));
    formData.append('issue_id', sourceIssue.node_id)
    formData.append('repository_id', destRepoInfo.node_id)

    let response = await fetch(sourceIssue.html_url + "/transfer", {
      method: "POST",
      body: formData
    })
    return Promise.resolve(response.url)
  }, sourceIssue, destRepoInfo);

  let destIssueNumber = parseInt(new URL(destIssueUrl).pathname.split('/').slice(-1)[0]);

  console.log("Issue transferred to " + destRepoInfo.full_name + "#" + destIssueNumber)

  // get labels from source issue
  sourceIssueLabelNames = []
  for (const l of sourceIssue.labels) {
    sourceIssueLabelNames.push(l.name)
  }

  // and apply them to the destination issue
  if (sourceIssueLabelNames.length > 0) {
    octokit.issues.addLabels({
      owner: destRepoInfo.owner.login,
      repo: destRepoInfo.name,
      issue_number: destIssueNumber,
      labels: sourceIssueLabelNames
    })
  }

  issueMapping.push({
    source: {
      owner: sourceRepoInfo.owner.login,
      repo: sourceRepoInfo.name,
      issueNumber: sourceIssue.number
    },
    dest: {
      owner: destRepoInfo.owner.login,
      repo: destRepoInfo.name,
      issueNumber: destIssueNumber
    }
  })
  await writeIssueMappingFile()
}

async function getRepoInformation(owner, repoName) {
  repo = await octokit.repos.get({
    owner: owner,
    repo: repoName
  })
  return repo.data
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false
  })
  const page = await browser.newPage()

  await loginToGithub(page, settings.auth)

  sourceRepoInfo = await getRepoInformation(settings.repos.source.owner,
    settings.repos.source.repoName)
  destRepoInfo = await getRepoInformation(settings.repos.dest.owner,
    settings.repos.dest.repoName)

  sourceIssues = await getSourceIssues()
  console.log("Found " + sourceIssues.length + " issue in the source repository.")

  for (const sourceIssue of sourceIssues) {
    sourceLabels = sourceIssue.labels
    await transferIssue(page, sourceIssue, sourceRepoInfo, destRepoInfo)
  }

  browser.close()
}

main()
