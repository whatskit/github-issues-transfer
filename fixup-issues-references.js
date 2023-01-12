#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0

/*
Command-line tool to update issue references in comments

After transferring an issue from one repository to another one, issue references
continue to go to the old repository. That's not a problem per se, since the
old issue URLs redirect to the new one.

If you still like to rewrite the issue comments, e.g. because the old repository
is not available any more, this script is for you.
*/

const settings = require('./settings.json')
const Octokit = require('@octokit/rest')
const fs = require('fs').promises

const octokit = new Octokit({
  auth: {
    username: settings.auth.username,
    password: settings.auth.password,
    /*async on2fa () {
      return options.secondfactor

      // example: ask the user
      return prompt('Two-factor authentication Code:')
  }*/
  }
})

async function getComments(owner, repoName) {
  const options = octokit.issues.listCommentsForRepo.endpoint.merge({
    owner: owner,
    repo: repoName
  })
  return octokit.paginate(options)
}

function rewriteComment(comment, issueMapping) {
  rewritten = comment
  for (e of issueMapping) {
    let fqIssueSource = e.source.owner + '/' + e.source.repo + '#' + e.source.issueNumber
    let issueUrlSource = 'https://(?:\\w+\\.)?github.com/' + e.source.owner + '/' + e.source.repo + '/issues/' + e.source.issueNumber
    let issueUrlDest = 'https://github.com/'+e.dest.owner + '/' + e.dest.repo + '/issues/' + e.dest.issueNumber
    let fqIssueDest = e.dest.owner + '/' + e.dest.repo + '#' + e.dest.issueNumber
    let reFqIssue = new RegExp('(\\b)' + fqIssueSource + '(\\b)', 'g')
    let reIssueUrl = new RegExp('(\\b)' + issueUrlSource + '(\\b)', 'ig')
    rewritten = rewritten.replace(reFqIssue, '$1' + fqIssueDest + '$2')
    rewritten = rewritten.replace(reIssueUrl, '$1' + issueUrlDest + '$2')
  }
  return rewritten
}

async function main() {
  const issueMapping = require('./' + settings.issueMappingFile)

  owner = settings.repos.dest.owner
  repoName = settings.repos.dest.repoName

  var comments = await getComments(owner, repoName)
  for (const comment of comments) {
    let before = comment.body
    let after = rewriteComment(before, issueMapping)
    if (after == before) {
      continue;
    }
    console.log("Rewriting comment:")
    console.log("Before-----------")
    console.log(before)
    console.log("After-------------")
    console.log(after)
    console.log("------------------")
    await octokit.issues.updateComment({
      owner: owner,
      repo: repoName,
      comment_id: comment.id,
      body: after
    })
  }
}

main()
