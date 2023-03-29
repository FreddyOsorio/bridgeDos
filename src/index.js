import express from 'express'
import { logRequest } from './middleware/logging.js'
import { asyncErrorWrapper, handleErrors } from './middleware/errors.js'
import { abortCredit, commitCredit, prepareCredit } from './handlers/credits.js'
import { abortDebit, commitDebit, prepareDebit } from './handlers/debits.js'
import { updateIntent } from './handlers/intents.js'
import * as persistence from './persistence.js'

process.on('exit', async () => {
  await persistence.shutdown()
})

await persistence.init()

const bankName = 'Demo bank Qik'
const port = 3001
console.log('index -->a');
const app = express()
console.log('index -->b');
app.use(express.json())
console.log('index -->c');
app.use(logRequest)
console.log('index -->1');
app.get('/', (req, res) => {
  res.send(`${bankName} is running!`)
})
console.log('index --> 2');
app.post('/v2/credits', asyncErrorWrapper(prepareCredit))
console.log('index -->3')
app.post('/v2/credits/:handle/commit', asyncErrorWrapper(commitCredit))
app.post('/v2/credits/:handle/abort', asyncErrorWrapper(abortCredit))

app.post('/v2/debits', asyncErrorWrapper(prepareDebit))
app.post('/v2/debits/:handle/commit', asyncErrorWrapper(commitDebit))
app.post('/v2/debits/:handle/abort', asyncErrorWrapper(abortDebit))

app.put('/v2/intents/:handle', asyncErrorWrapper(updateIntent))

app.use(handleErrors)

app.listen(port, () => {
  console.log(`${bankName} running on port ${port}`)
})
