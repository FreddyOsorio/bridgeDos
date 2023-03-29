import {
  beginActionExisting,
  beginActionNew,
  endAction,
  saveIntent,
} from './common.js'
import { transactionWrapper, updateEntry } from '../persistence.js'
import { ledgerSigner, notifyLedger } from '../ledger.js'
import {
  extractAndValidateData,
  validateAction,
  validateEntity,
} from '../validators.js'
import core from '../core.js'

export async function prepareCredit(req, res) {
  console.log('prepareCredit');
  const action = 'prepare'
  console.log('prepareCredit 1');
  // Begin Action processing for new Entry which will also save it.
  let { alreadyRunning, entry } = await beginActionNew({
    request: req,
    action,
  })
  console.log('prepareCredit 2');
  // The Entry is already saved, so we can return 202 Accepted
  // to Ledger so that it stops redelivering the Action.
  res.sendStatus(202)
  console.log('prepareCredit 3');
  // If the Action is already being processed, skip processing.
  if (!alreadyRunning) {
    await processPrepareCredit(entry)
    console.log('prepareCredit 4');
    // Stop Action processing and save the result.
    await endAction(entry)
  }
  console.log('prepareCredit 5');
  // If Entry is in final state, return the result to Ledger
  await notifyLedger(entry, action, ['prepared', 'failed'])
  console.log('prepareCredit 6');
}

async function processPrepareCredit(entry) {
  console.log('processPrepareCredit 1');
  const action = entry.actions[entry.processingAction]
  console.log('processPrepareCredit 2');
  try {
    // Parse data from the Entry and validate it.
    validateEntity(
      { hash: entry.hash, data: entry.data, meta: entry.meta },
      ledgerSigner,
    )
    console.log('processPrepareCredit 3');
    validateEntity(entry.data?.intent)
    console.log('processPrepareCredit 4');
    validateAction(action.action, entry.processingAction)
    console.log('processPrepareCredit 5');
    const { address, symbol, amount } = extractAndValidateData({
      entry,
      schema: 'credit',
    })
    console.log('processPrepareCredit 6');
    // Save extracted data into Entry, we will need this for other Actions.
    entry.schema = 'credit'
    entry.account = address.account
    entry.symbol = symbol
    entry.amount = amount
    console.log('processPrepareCredit 7');
    // Save Entry.
    await transactionWrapper(async (client) => {
      await updateEntry(client, entry)
    })
    console.log('processPrepareCredit 8');
    
    // Save Intent from Entry.
    await saveIntent(entry.data.intent)
    console.log('processPrepareCredit 9');
    //QIK_COMMENT Se debe llamar al MS Transferencias http://localhost:3000/credits/prepare-credit 
    // Processing prepare Action for Credit Entry in the core is simple and
    // only checks if the account exists and is active. If something is wrong,
    // an Error will be thrown, and we will catch it later.
    const coreAccount = core.getAccount(Number(entry.account))
    console.log('processPrepareCredit 10');
    coreAccount.assertIsActive()
    console.log('processPrepareCredit 11');
    action.state = 'prepared'
  } catch (error) {
    //QIK_COMMENT Se debe llamar al MS Transferencias http://localhost:3000/credits/abort-credit con el disparador prepare-credit 
    console.log(error)
    action.state = 'failed'
    action.error = {
      reason: 'bridge.unexpected-error',
      detail: error.message,
      failId: undefined,
    }
  }
}

export async function commitCredit(req, res) {
  const action = 'commit'
  let { alreadyRunning, entry } = await beginActionExisting({
    request: req,
    action,
    previousStates: ['prepared'],
  })

  res.sendStatus(202)

  if (!alreadyRunning) {
    await processCommitCredit(entry)
    await endAction(entry)
  }

  await notifyLedger(entry, action, ['committed'])
}

async function processCommitCredit(entry) {
  const action = entry.actions[entry.processingAction]
  let transaction
  try {
    validateEntity(
      { hash: action.hash, data: action.data, meta: action.meta },
      ledgerSigner,
    )
    validateAction(action.action, entry.processingAction)
      //QIK_COMMENT Se debe llamar al MS Transferencias http://localhost:3000/credits/commit-credit 
    transaction = core.credit(
      Number(entry.account),
      entry.amount,
      `${entry.handle}-credit`,
    )
    action.coreId = transaction.id.toString()

    if (transaction.status !== 'COMPLETED') {
      throw new Error(transaction.errorReason)
    }

    action.state = 'committed'
  } catch (error) {
    //QIK_COMMENT Se debe llamar al MS Transferencias http://localhost:3000/credits/abort-credit  con el disparador commit-credit
    console.log(error)
    action.state = 'error'
    action.error = {
      reason: 'bridge.unexpected-error',
      detail: error.message,
      failId: undefined,
    }
  }
}

export async function abortCredit(req, res) {
  const action = 'abort'
  let { alreadyRunning, entry } = await beginActionExisting({
    request: req,
    action,
    previousStates: ['prepared', 'failed'],
  })

  res.sendStatus(202)

  if (!alreadyRunning) {
    await processAbortCredit(entry)
    await endAction(entry)
  }

  await notifyLedger(entry, action, ['aborted'])
}

async function processAbortCredit(entry) {
  const action = entry.actions[entry.processingAction]
  try {
    validateEntity(
      { hash: action.hash, data: action.data, meta: action.meta },
      ledgerSigner,
    )
    validateAction(action.action, entry.processingAction)

    //QIK_COMMENT Se debe llamar al MS Transferencias http://localhost:3000/credits/abort-credit con el disparador abort-credit 
    action.state = 'aborted'
  } catch (error) {
    console.log(error)
    action.state = 'error'
    action.error = {
      reason: 'bridge.unexpected-error',
      detail: error.message,
      failId: undefined,
    }
  }
}
