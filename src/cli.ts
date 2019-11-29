import validateEnv from 'valid-env'
import program from 'commander'
import chalk from 'chalk'
import cron from 'node-cron'
import debugFn from 'debug'

import { TrelloClient, TrelloCard, TrelloLabel } from '@openlab/trello-client'

import { redCross } from './consts'
import { promisifiedRedis } from './promisified-redis'
import { pack, unpack, logItems, logContent, extractContent } from './utils'

const debug = debugFn('trello-scraper:cli')

// Ensure required variables are set or exit(1)
validateEnv([
  'TRELLO_APP_KEY',
  'TRELLO_TOKEN',
  'TRELLO_BOARD_ID',
  'TRELLO_TARGET_LIST_ID',
  'REDIS_URL'
])

// Destructure environment variables to give them types
const {
  TRELLO_BOARD_ID,
  TRELLO_TARGET_LIST_ID,
  TRELLO_APP_KEY,
  TRELLO_TOKEN,
  REDIS_URL
} = process.env as Record<string, string>

const { TRELLO_CONTENT_LIST_ID } = process.env

// Create a client to talk to trello
const trello = new TrelloClient(TRELLO_APP_KEY, TRELLO_TOKEN)

// Create a connection to redis
const redis = promisifiedRedis(REDIS_URL)

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
  .command('show:labels')
  .description('Show the trello labels in redis')
  .action(showLabels)

program
  .command('show:cards')
  .description('Show the matched trello cards in redis')
  .action(showCards)

program
  .command('show:content')
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
  redis.quit()
  process.exit(1)
}

// Process args
program.parse(process.argv)

//
// CLI Utils
//

/** Perform the fetch from trello */
async function trelloFetch(verbose: boolean, dryRun: boolean) {
  debug(
    `#trelloFetch targetId=${TRELLO_TARGET_LIST_ID} contentId=${TRELLO_CONTENT_LIST_ID}`
  )

  const labels = await trello.fetchLabels(TRELLO_BOARD_ID)
  const lists = await trello.fetchLists(TRELLO_BOARD_ID)

  debug(`#trelloFetch labels=${labels.length} lists=${lists.length}`)

  const targetLists = lists.filter(l => l.id === TRELLO_TARGET_LIST_ID)
  const contentLists = lists.filter(l => l.id === TRELLO_CONTENT_LIST_ID)

  const cards = targetLists.reduce(
    (a, l) => a.concat(l.cards),
    [] as TrelloCard[]
  )
  const content = extractContent(contentLists)

  debug(`#trelloFetch cards=${cards.length}`)

  if (dryRun) {
    logItems(cards, 'card', p => `${chalk.green(p.id)} ${p.name}`)
    logContent(content)
  } else {
    await redis.set('labels', pack(labels))
    await redis.set('cards', pack(cards))
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
    await redis.quit()
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
async function showLabels(cmd: program.Command) {
  try {
    let labels: TrelloLabel[] = unpack(await redis.get('labels'))
    if (!labels) return console.log('No labels found')

    logItems<TrelloLabel>(labels, 'label', l => [
      chalk.green(l.id),
      l.name || 'no_name',
      chalk.grey(l.color || 'hidden')
    ])

    await redis.quit()
  } catch (error) {
    console.log(redCross, error.message)
    process.exit(1)
  }
}

/** Show the content stored in redis */
async function showContent(cmd: program.Command) {
  try {
    let content: Record<string, string> = unpack(await redis.get('content'))
    if (!content) return console.log('No content found')

    logContent(content)

    await redis.quit()
  } catch (error) {
    console.log(redCross, error.message)
    process.exit(1)
  }
}

async function showCards(cmd: program.Command) {
  try {
    let cards: TrelloCard[] = unpack(await redis.get('cards'))

    logItems(cards, 'card', c => [chalk.green(c.id), c.name])

    await redis.quit()
  } catch (error) {
    console.log(redCross, error.message)
    process.exit(1)
  }
}
