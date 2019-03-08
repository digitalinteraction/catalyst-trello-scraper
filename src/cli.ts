import validateEnv from 'valid-env'
import program from 'commander'
import chalk from 'chalk'
import cron from 'node-cron'
import { formatMilliseconds } from 'format-ms'

import { TrelloClient } from './TrelloClient'
import { AsyncRedisClient } from './AsyncRedisClient'
import { redCross } from './consts'
import { Project, StringObject } from './types'

// Ensure required variables are set or exit(1)
validateEnv([
  'TRELLO_APP_KEY',
  'TRELLO_TOKEN',
  'TRELLO_BOARD_ID',
  'TRELLO_LIST_ID',
  'REDIS_URL'
])

// Create a client to talk to trello
const trello = new TrelloClient(
  process.env.TRELLO_APP_KEY!,
  process.env.TRELLO_TOKEN!
)

// Create a connection to redis
const redis = new AsyncRedisClient(process.env.REDIS_URL!)

// Utilities to pack/unpack for redis (could change implementation later?)
const pack = (data: any) => JSON.stringify(data)
const unpack = (data: any) => JSON.parse(data)

// Destructure environment variables to give them types
const {
  TRELLO_BOARD_ID: boardId,
  TRELLO_LIST_ID: listId
} = process.env as StringObject

//
// Create our `commander` program and add commands
//

program
  .name(process.env.npm_package_name!)
  .version(process.env.npm_package_version!)

program
  .command('fetch')
  .description('Fetch the current projects and content and store them in redis')
  .option('--dry-run', 'Only output projects', false)
  .option('--verbose', 'Output additional info', false)
  .action(fetch)

program
  .command('schedule <cron>')
  .description('Schedule a fetch based on a cron job, https://crontab.guru')
  .option(
    '--timezone [zone]',
    'The timezone to schedule in [Europe/London]',
    'Europe/London'
  )
  .option('--verbose', 'Output additional info', false)
  .action(schedule)

program
  .command('list-projects')
  .description('List projects that are stored in redis')
  .action(listProjects)

program
  .command('show-content')
  .description('Show the content stored in redis')
  .action(showContent)

// Fail on unknown commands
program.on('command:*', () => {
  console.log(redCross, 'Unknown command, try --help')
  process.exit(1)
})

// Fail if no command was entered
// -> The first 2 args are the command and file
if (process.argv.length < 3) {
  program.outputHelp()
  redis.close()
  process.exit(1)
}

// Process args
program.parse(process.argv)

//
// CLI Utils
//

/** Perform the fetch from trello */
async function trelloFetch(verbose: boolean, dryRun: boolean) {
  let startTime = Date.now()

  const board = await trello.fetchBoard(boardId)
  const projects = trello.fetchProjects(board, listId)
  const content = trello.fetchContent(board)

  if (verbose) {
    console.log(
      new Date().toISOString(),
      `(${formatMilliseconds(Date.now() - startTime)})`,
      `Fetched ${projects.length} projects`
    )
  }

  if (dryRun) {
    outputProjects(projects)
    outputContent(content)
  } else {
    await redis.set('projects', pack(projects))
    await redis.set('content', pack(content))
  }
}

//
// CLI actions
//

/** Fetch projects and store them in redis */
async function fetch(cmd: program.Command) {
  try {
    await trelloFetch(cmd.verbose, cmd.dryRun)
    await redis.close()
  } catch (error) {
    console.log(redCross, 'Fetch failed:', error.message)
    process.exit(1)
  }
}

/** Schedule a fetch using a crontab-esk syntax */
async function schedule(schedule: string, cmd: program.Command) {
  const { timezone } = cmd

  if (!cron.validate(schedule)) {
    console.log(redCross, `Invalid cron '${schedule}'`)
    process.exit(1)
  }

  let url = chalk.yellow.underline(
    `https://crontab.guru/#${schedule.replace(/\s/g, '_')}`
  )

  console.log(`Scheduled for '${schedule}' in ${timezone}`)
  console.log('see:', url)
  cron.schedule(
    schedule,
    async () => {
      try {
        await trelloFetch(cmd.verbose, false)
      } catch (error) {
        console.log(redCross, 'Fetch failed:', error.message)
      }
    },
    { timezone }
  )
}

/** List projects stored in redis */
async function listProjects(cmd: program.Command) {
  try {
    let projects = unpack(await redis.get('projects'))
    outputProjects(projects)

    await redis.close()
  } catch (error) {
    console.log(redCross, `List failed: ${error.message}`)
    process.exit(1)
  }
}

/** Show the content stored in redis */
async function showContent(cmd: program.Command) {
  try {
    let content = unpack(await redis.get('content'))
    outputContent(content)

    await redis.close()
  } catch (error) {
    console.log(redCross, `List failed: ${error.message}`)
    process.exit(1)
  }
}

/** Output projects in a structured way */
function outputProjects(projects: Project[] = []) {
  if (projects.length === 0) {
    console.log('No projects found')
    return
  }

  console.log(`Found ${projects.length} projects`)

  for (let i in projects) {
    console.log(`${parseInt(i) + 1}. ${projects[i].name}`)
  }
}

/** Output content */
function outputContent(content: StringObject = {}) {
  if (Object.keys(content).length === 0) {
    console.log('No content found')
    return
  }

  console.log(`Found content:`)

  for (let key in content) {
    console.log(`[${key}] = "${content[key]}"\n`)
  }
}
