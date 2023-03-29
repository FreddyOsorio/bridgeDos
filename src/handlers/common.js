import {
  createEntry,
  getEntry,
  transactionWrapper,
  updateEntry,
  upsertIntent,
} from '../persistence.js'

export async function beginActionNew({ request, action }) {
  return await transactionWrapper(async (client) => {
    console.log('common --> beginActionNew-->1');
    const handle = request.body?.data?.handle
    console.log('common --> beginActionNew-->2');
    // We don't check many things before we start processing, but we
    // will need the handle, so we just check its existence.
    if (!handle) {
      throw new Error('Invalid handle')
    }
    console.log('common --> beginActionNew-->3');
    let entry = await getEntry(client, handle)
    console.log('common --> beginActionNew-->4');
    // If the Entry does not exist already, create it.
    if (!entry) {
      console.log('common --> beginActionNew-->5');
      entry = await createEntry(client, {
        handle,
        hash: request.body.hash,
        data: request.body.data,
        meta: request.body.meta,
        schema: null,
        account: null,
        symbol: null,
        amount: null,
        state: null,
        previousState: null,
        actions: {},
        processingAction: null,
        processingStart: null,
      })
      console.log('common --> beginActionNew-->6');
    }
    console.log('common --> beginActionNew-->7');
    const alreadyRunning = !!entry.processingAction
    console.log('common --> beginActionNew-->8');
    // If we are already processing an Action for this Entry, and it's
    // not the same Action, something has gone wrong, or we are not ready
    // to process this action, so we throw an Error.
    if (alreadyRunning) {
      console.log('common --> beginActionNew-->9');
      if (entry.processingAction !== request.body?.action) {
        throw new Error('Already processing another action.')
      } else {
        return { alreadyRunning: true, entry }
      }
    }
    console.log('common --> beginActionNew-->10');
    // We update the Entry and Action to indicate that processing has started.
    const processingStart = new Date()
    console.log('common --> beginActionNew-->11');
    // It may not be immediately obvious where we will need some of these properties
    // right now, but it will become clear as we progress with the tutorial.
    entry.previousState = entry.state
    entry.state = `processing-${action}`
    console.log('common --> beginActionNew-->12');
    entry.actions[action] = {
      hash: undefined,
      data: undefined,
      meta: undefined,
      action: action,
      state: 'processing',
      coreId: undefined,
      error: {
        reason: undefined,
        detail: undefined,
        failId: undefined,
      },
      processingStart,
      processingEnd: null,
    }
    console.log('common --> beginActionNew-->13');
    entry.processingAction = action
    entry.processingStart = processingStart
    console.log('common --> beginActionNew-->14');
    // Save the result.
    entry = await updateEntry(client, entry)
    console.log('common --> beginActionNew-->15');
    return { alreadyRunning: false, entry }
  })
}

export async function beginActionExisting({ request, action, previousStates }) {
  return await transactionWrapper(async (client) => {
    const handle = request.body?.data?.handle

    if (!handle) {
      throw new Error('Invalid handle')
    }

    if (request.params.handle && request.params.handle !== handle) {
      throw new Error('Request parameter handle not equal to entry handle.')
    }

    let entry = await getEntry(client, handle)

    if (!entry) {
      throw new Error('Entry does not exist.')
    }

    const alreadyRunning = !!entry.processingAction

    if (alreadyRunning) {
      if (entry.processingAction !== request.body?.action) {
        throw new Error('Already processing another action.')
      } else {
        return { alreadyRunning: true, entry }
      }
    }

    if (!previousStates.includes(entry.state)) {
      throw new Error(
        `Invalid previous state (${entry.state}) for action ${action}.`,
      )
    }

    const processingStart = new Date()

    entry.previousState = entry.state
    entry.state = `processing-${action}`
    entry.actions[action] = {
      hash: request.body?.hash,
      data: request.body?.data,
      meta: request.body?.meta,
      action: request.body?.data?.action,
      state: 'processing',
      coreId: undefined,
      error: {
        reason: undefined,
        detail: undefined,
        failId: undefined,
      },
      processingStart,
      processingEnd: null,
    }
    entry.processingAction = action
    entry.processingStart = processingStart

    entry = await updateEntry(client, entry)
    return { alreadyRunning: false, entry }
  })
}

export async function endAction(entry) {
  return await transactionWrapper(async (client) => {
    const currentAction = entry.actions[entry.processingAction]

    // Mark the Entry processing as completed and save the results.
    entry.previousState = entry.state
    entry.state = currentAction.state
    entry.processingAction = null
    entry.processingStart = null

    currentAction.processingEnd = new Date()

    entry = await updateEntry(client, entry)
    return entry
  })
}

export async function saveIntent(intent) {
  console.log('common --> saveIntent');
  return await transactionWrapper(async (client) => {
    await upsertIntent(client, { handle: intent?.data?.handle, ...intent })
  })
}
