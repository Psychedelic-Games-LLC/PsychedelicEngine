import { defineAction } from '@xrengine/hyperflux'

export const BasketballClientAction = {
  throw: defineAction({
    type: 'basketball.THROW'
  }),
  spawnNPC: defineAction({
    type: 'basketball.SPAWN_NPC'
  })
}
