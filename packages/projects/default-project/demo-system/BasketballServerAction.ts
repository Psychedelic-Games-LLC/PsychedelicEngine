import { matches, matchesNetworkId } from '@xrengine/engine/src/common/functions/MatchesUtils'
import { defineAction } from '@xrengine/hyperflux'

export const BasketballServerAction = {
  spawnBallNetworkObject: defineAction({
    type: 'basketball-s.spawnBallNetworkObject',
    networkId: matchesNetworkId
  }),
  spawnNpcNetworkObject: defineAction({
    type: 'basketball-s.spawnNpcNetworkObject',
    networkId: matchesNetworkId,
    name: matches.string
  })
}
