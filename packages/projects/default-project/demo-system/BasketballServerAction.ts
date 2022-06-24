import {
  matches,
  matchesNetworkId,
  matchesUserId,
  matchesVector3
} from '@xrengine/engine/src/common/functions/MatchesUtils'
import { matchesAvatarProps } from '@xrengine/engine/src/networking/interfaces/WorldState'
import { defineAction } from '@xrengine/hyperflux'

export const BasketballServerAction = {
  spawnBallNetworkObject: defineAction({
    type: 'basketball-s.spawnBallNetworkObject',
    networkId: matchesNetworkId
  }),
  spawnNpcNetworkObject: defineAction({
    type: 'basketball-s.spawnNpcNetworkObject',
    networkId: matchesNetworkId,
    avatarDetails: matchesAvatarProps,
    name: matches.string
  }),
  changeNpcAvatar: defineAction({
    type: 'basketball-s.changeNpcAvatar',
    networkId: matchesNetworkId,
    avatarDetails: matchesAvatarProps
  }),
  switchAvatarEntity: defineAction({
    type: 'basketball-s.switchAvatarEntity',
    avatarDetail: matchesAvatarProps,
    targetPosition: matchesVector3
  })
}
