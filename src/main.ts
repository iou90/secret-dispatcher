import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import fs from 'fs'
import path from 'path'
const sodium = require('tweetsodium')

interface SecretData {
  [key: string]: string
}

interface OrgRequestExtraData {
  org: string
  visibility: string
}

interface RepoRequestExtraData {
  owner: string
  repo: string
}

const dispatchSecret = async (
  octokit: Octokit,
  publicKeyRequest: string,
  secretRequest: string,
  secretRequestExtraData: OrgRequestExtraData | RepoRequestExtraData,
  secretData: SecretData,
  target: string
): Promise<void> => {
  const {key, key_id} = (await octokit.request(publicKeyRequest)).data
  const promises = []
  for (const [secret_name, value] of Object.entries(secretData)) {
    const encrypted_value = Buffer.from(
      sodium.seal(Buffer.from(value), Buffer.from(key, 'base64'))
    ).toString('base64')
    promises.push(
      octokit.request(`${secretRequest}/${secret_name}`, {
        ...secretRequestExtraData,
        secret_name,
        encrypted_value,
        key_id
      })
    )
  }
  await Promise.all(promises)
  core.info(`${target} secret dispatched`)
}

const dispatchOrgSecret = async (
  octokit: Octokit,
  org: string,
  secretData: SecretData
): Promise<void> =>
  dispatchSecret(
    octokit,
    `GET /orgs/${org}/actions/secrets/public-key`,
    `PUT /orgs/${org}/actions/secrets`,
    {org, visibility: 'all'},
    secretData,
    org
  )

const dispatchRepoSecret = async (
  octokit: Octokit,
  target: string,
  secretData: SecretData
): Promise<void> => {
  const [owner, repo] = target.split('/')
  dispatchSecret(
    octokit,
    `GET /repos/${owner}/${repo}/actions/secrets/public-key`,
    `PUT /repos/${owner}/${repo}/actions/secrets`,
    {
      owner,
      repo
    },
    secretData,
    target
  )
}

async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token')
    const secretData: SecretData = JSON.parse(
      fs.readFileSync(
        path.join(
          process.env.GITHUB_WORKSPACE as string,
          core.getInput('json-path')
        ),
        'utf8'
      )
    )
    const octokit = new Octokit({auth: token})
    const targets = core.getInput('targets').split(',')
    for (const item of targets) {
      const target = item.trim()
      if (target.includes('/')) {
        await dispatchRepoSecret(octokit, target, secretData)
      } else {
        await dispatchOrgSecret(octokit, target, secretData)
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
      core.setFailed(error.message)
    }
  }
}

run()
