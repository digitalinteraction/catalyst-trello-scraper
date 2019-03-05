# Catalyst | Trello Scraper

This is the repo for the Not-Equal Catalyst's Trello scraper.
It is a [node.js](https://nodejs.org)
CLI written in [TypeScript](https://www.typescriptlang.org/)
and deployed through [Docker](https://www.docker.com/).
It queries the Trello API for cards on a specific list,
parses relationships from card labels, then writes into [redis](https://redis.io/).

[What is Not-Equal Catalyst?](https://github.com/unplatform/catalyst-about)

<!-- toc-head -->

## Table of Contents

- [Why a CLI](#why-a-cli)
- [Development](#development)
  - [Setup](#setup)
  - [Regular use](#regular-use)
  - [Irregular use](#irregular-use)
  - [Code Structure](#code-structure)
  - [Code formatting](#code-formatting)
- [Deployment](#deployment)
  - [Building the image](#building-the-image)
  - [Using the image](#using-the-image)

<!-- toc-tail -->

## Why a CLI

This is a CLI that is designed to be run with Docker and docker-compose.
This means you can set environment variables and link in a redis container.

It uses Docker's `ENTRYPOINT` so that you can pass your CLI command via docker.
This means you can deploy and run through `docker-compose` and customise the command
at the deployment level, not at the application level.

## Development

### Setup

To develop on this repo you will need to have [Docker](https://www.docker.com/) and
[node.js](https://nodejs.org) installed on your dev machine and have an understanding of them.
This guide assumes you are on macOS, but equivalent commands are available.
You will also need a Trello account which is used to pull the data from.

You'll only need to follow this setup once for your dev machine.

```bash
# Install dependancies
npm install

# Setup your environment
cp .env.example .env

# Get your Trello App Key and put it into your .env
open https://trello.com/app-key

# Generate a Trello token for development, then fill it into your .env
. .env
open "https://trello.com/1/authorize?expiration=never&scope=read&response_type=token&name=Husky%20CMS&key=$TRELLO_APP_KEY"

# To get your TRELLO_BOARD_ID & TRELLO_LIST_ID, visit the board you want to pull from on the trello.com
# Then add .json to the end of the url and inspect the contents to find your values
open https://trello.com
```

### Regular use

These are the commands you'll regularly run to develop the CLI, in no particular order.

```bash
# Spin up a local redis instance for development
# -> Launches a redis:4-alpine docker container (you'll need docker running)
# -> Binds port 6379 to localhost:6379
# -> Names the container dev_redis
npm run redis

# Run the CLI in development mode
# -> Runs the TypeScript directly with `ts-node` and loads the .env
# -> Use the `--` to stop npm swallowing the dash-dash arguments
npm run dev -- --help

# Execute redis commands to inspect the store
# -> Runs a command in the redis container (started by `npm run redis`)
# -> Attaches std in/output so it behaves like you've ssh'd into it
# -> Runs the internal redis-cli, so you can directly talk to redis
# -> For reference: https://redis.io/commands
npm run redis-cli

# Useful redis commands
127.0.0.1:6379> keys *       # List all keys
127.0.0.1:6379> get projects # Get projects

# Run unit tests
# -> Looks for files named `*.spec.ts` in the src directory
npm run test
```

### Irregular use

These are commands you might need to run but probably won't, also in no particular order.

```bash
# Generate the table of contents for this readme
# -> It'll replace content between the toc-head and toc-tail HTML comments
npm run gen-readme-toc

# Manually lint code with TypeScript's `tsc`
npm run lint

# Manually format code
# -> This repo is setup to automatically format code on git-push
npm run prettier

# Manually transpile TypeScript to JavaScript
# -> This is part of the docker build which is triggered when deploying
# -> Writes files to dist, which is git-ignored
npm run build

# Manually start code from transpilled JavaScript
# -> It'll automatically load your local .env
npm run start
```

### Code Structure

| Folder       | Contents                                     |
| ------------ | -------------------------------------------- |
| dist         | Where the transpilled JavaScript is built to |
| node_modules | Where npm's modules get installed into       |
| src          | Where the code of the app is                 |

### Code formatting

This repo uses [Prettier](https://prettier.io/) to automatically format code to a consistent standard.
This works using the [husky](https://www.npmjs.com/package/husky)
and [lint-staged](https://www.npmjs.com/package/lint-staged) packages to
automatically format code whenever you commit code.
This means that code that is pushed to the repo is always formatted to a consistent standard.

You can manually run the formatter with `npm run prettier` if you want.

Prettier is slightly configured in [.prettierrc.yml](/.prettierrc.yml)
and also ignores files using [.prettierignore](/.prettierignore).

### Testing

> This CLI is currently quite simple and doesn't have any unit tests yet

This repo uses [unit tests](https://en.wikipedia.org/wiki/Unit_testing) to ensure that everything is working correctly, guide development, avoid bad code and reduce defects.
The [Jest](https://www.npmjs.com/package/jest) package is used to run unit tests.
Tests are any file in `src/` that ends with `.spec.ts`, by convention they are inline with the source code,
in a parallel folder called `__tests__`.

```bash
# Run the tests
npm test -s

# Generate code coverage
npm run coverage -s
```

## Deployment

### Building the image

This repo uses a [GitLab CI](https://about.gitlab.com/product/continuous-integration/)
to build a Docker image when you push a git tag.
This is designed to be used with the `npm version` command so all docker images are [semantically versioned](https://semver.org/).
The `:latest` docker tag is not used.

This job runs using the [.gitlab-ci.yml](/.gitlab-ci.yml) file which
runs a docker build using the [Dockerfile](/Dockerfile)
and **only** runs when you push a [tag](https://git-scm.com/book/en/v2/Git-Basics-Tagging).

It pushes these docker images to the [GitLab registry](https://openlab.ncl.ac.uk/gitlab/catalyst/trello-scraper/container_registry).
A slight nuance is that it will replace a preceding `v` in tag names, formatting `v1.0.0` to `1.0.0`.

```bash
# Deploy a new version of the CLI
npm version # major | minor | patch
git push --tags
open https://openlab.ncl.ac.uk/gitlab/catalyst/trello-scraper/-/jobs
```

### Using the image

With this docker image you can easily deploy and run the CLI using docker-compose.
You'll need to set your environment variables, similar to [Regular use](#regular-use).

Here is an example `docker-compose.yml`:

> Notes:
>
> - You pass the same commands as `npm run dev` to the `command` attribute
> - You can set non-secret environment variables with the `environment` option.
> - Don't actually run this docker-compose.yml, it's an example

```yml
version: '3'

services:
  # A data store for projects, lightweight and stored in memory
  redis:
    image: redis:4-alpine
    restart: unless-stopped

  # Just run the scraper once and dump content to redis
  one-time-scraper:
    image: openlab.ncl.ac.uk:4567/catalyst/trello-scraper:0.3.0
    env_file: .env
    environment:
      REDIS_URL: redis://redis
      TRELLO_BOARD_ID: 5c5aed4d6f28188f43ba86d4
      TRELLO_LIST_ID: 5c5aee796eb6b98ee9e5a684
    command: fetch --verbose

  # Run the scraper every 2 minutes, dumping content to redis
  scheduled-scraper:
    image: openlab.ncl.ac.uk:4567/catalyst/trello-scraper:0.3.0
    env_file: .env
    environment:
      REDIS_URL: redis://redis
      TRELLO_BOARD_ID: 5c5aed4d6f28188f43ba86d4
      TRELLO_LIST_ID: 5c5aee796eb6b98ee9e5a684
    command: schedule "*/2 * * * *" --verbose
```

Here's the output of the `--help` option for reference

```
Usage: cli.ts [options] [command]

Options:
  -V, --version              output the version number
  -h, --help                 output usage information

Commands:
  fetch [options]            Fetch the current projects and store them in redis
  schedule [options] <cron>  Schedule a fetch based on a cron job, https://crontab.guru
  ls                         List projects that are stored in redis
```
