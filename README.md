# secret-dispatcher action

This action dispatch secret to repos/orgs.

## Inputs

## `token`

**Required** Github token.

## `json-path`

**Required** Relative json file path in your repository that uses this action. format: { "xxx_secret_name": "xxx_secret_value", ... }.

## `targets`

**Required** Repository/organization list, example: org_xxx, XXX/repo_xxx.
