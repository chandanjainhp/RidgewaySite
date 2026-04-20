import { appendAgentEvent, setAgentState } from '../db/redis.js'

const activeStreams = new Map()
const eventBuffers = new Map()

export const registerStream = (jobId, write) => {
  activeStreams.set(jobId, write)
  console.log('[StreamRegistry] Registered:', jobId)

  const buffered = eventBuffers.get(jobId) || []
  if (buffered.length > 0) {
    console.log('[StreamRegistry] Replaying', buffered.length,
      'buffered events for', jobId)
    buffered.forEach(event => write(event))
    eventBuffers.delete(jobId)
  }
}

export const unregisterStream = (jobId) => {
  activeStreams.delete(jobId)
  eventBuffers.delete(jobId)
  console.log('[StreamRegistry] Unregistered:', jobId)
}

export const emitToStream = async (jobId, event) => {
  try {
    await setAgentState(jobId, event)
    await appendAgentEvent(jobId, event)
  } catch (error) {
    console.error('[StreamRegistry] Redis error:', error.message)
  }

  const write = activeStreams.get(jobId)
  if (write) {
    write(event)
    console.log('[StreamRegistry] Emitted:', jobId, event?.type)
  } else {
    if (!eventBuffers.has(jobId)) {
      eventBuffers.set(jobId, [])
    }
    eventBuffers.get(jobId).push(event)
    console.log('[StreamRegistry] Buffered:', jobId, event?.type,
      'buffer size:', eventBuffers.get(jobId).length)
  }
}
