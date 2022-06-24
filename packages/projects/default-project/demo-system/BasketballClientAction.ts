import { matchesAvatarProps } from '@xrengine/engine/src/networking/interfaces/WorldState'
import { defineAction } from '@xrengine/hyperflux'

export const BasketballClientAction = {
  spawnBall: defineAction({
    type: 'basketball.SPAWN_BALL'
  }),
  spawnNPC: defineAction({
    type: 'basketball.SPAWN_NPC',
    avatarDetails: matchesAvatarProps
  }),
  switchAvatarRequest: defineAction({
    type: 'basketball.switchAvatarRequestTeleport'
  }),
  switchAvatarRequest2: defineAction({
    type: 'basketball.switchAvatarRequest2' // ChangeOwnerAndNetworkId
  }),
  throwBallStart: defineAction({
    type: 'basketball.THROW_BALL_START'
  }),
  throwBallRelease: defineAction({
    type: 'basketball.THROW_BALL_RELEASE'
  })
}
