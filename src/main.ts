import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import fs from 'fs'
const sodium = require('tweetsodium')

interface SecretData {
  [key: string]: string
}

const dispatchOrgSecret = async (
  octokit: Octokit,
  org: string,
  secret_name: string,
  secretValue: string
): Promise<void> => {
  const key: string = (
    await octokit.request(`GET /orgs/${org}/actions/secrets/public-key`)
  ).data.key
  const encrypted_value = Buffer.from(
    sodium.seal(Buffer.from(secretValue), Buffer.from(key, 'base64'))
  ).toString('base64')
  await octokit.request(`PUT /orgs/${org}/actions/secrets/${secret_name}`, {
    org,
    secret_name,
    encrypted_value
  })
  console.log(`${org} secret dispatched`)
}

const dispatchRepoSecret = async (
  octokit: Octokit,
  target: string,
  secret_name: string,
  secretValue: string
): Promise<void> => {
  const [owner, repo] = target.split('/')
  const key: string = (
    await octokit.request(
      `GET /repos/${owner}/${repo}/actions/secrets/public-key`
    )
  ).data.key
  const encrypted_value = Buffer.from(
    sodium.seal(Buffer.from(secretValue), Buffer.from(key, 'base64'))
  ).toString('base64')
  await octokit.request(
    `PUT /repos/${owner}/${repo}/actions/secrets/${secret_name}`,
    {
      owner,
      repo,
      secret_name,
      encrypted_value
    }
  )
  console.log(`${target} secret dispatched`)
}

async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token')
    const secretData: SecretData = JSON.parse(
      fs.readFileSync(core.getInput('json-path'), 'utf8')
    ).secret
    const secretName = Object.keys(secretData)[0]
    const secretValue = Object.values(secretData)[0]
    const octokit = new Octokit({auth: token})
    const targets = core.getInput('targets').split(',')
    for (const item of targets) {
      const target = item.trim()
      if (target.includes('/')) {
        dispatchOrgSecret(octokit, target, secretName, secretValue)
      } else {
        dispatchRepoSecret(octokit, target, secretName, secretValue)
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
