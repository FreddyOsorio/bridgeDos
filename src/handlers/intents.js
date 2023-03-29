import { validateEntity } from '../validators.js'
import { saveIntent } from './common.js'

export async function updateIntent(req, res) {
  validateEntity(req.body)
  const handle = req.params.handle
  console.log('updateIntent')
  if (handle !== req.body?.data?.handle) {
    throw new Error('Request parameter handle not equal to entry handle.')
  }
  console.log('updateIntent --> saveIntent')
  await saveIntent(req.body)
  console.log('updateIntent --> saveIntent 2')
  res.sendStatus(200)
}
