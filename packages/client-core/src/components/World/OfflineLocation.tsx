import React, { useEffect } from 'react'

import { useAuthState } from '@xrengine/client-core/src/user/services/AuthService'
import { SpawnPoints } from '@xrengine/engine/src/avatar/AvatarSpawnSystem'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { getEngineState } from '@xrengine/engine/src/ecs/classes/EngineState'
import { Network, NetworkTypes } from '@xrengine/engine/src/networking/classes/Network'
import { receiveJoinWorld } from '@xrengine/engine/src/networking/functions/receiveJoinWorld'
import { useState } from '@xrengine/hyperflux'

import { client } from '../../feathers'
import GameServerWarnings from './GameServerWarnings'

export const OfflineLocation = () => {
  const engineState = useState(getEngineState())
  const authState = useAuthState()

  async function joinWorld() {
    const user = await client.service('user').get(Engine.instance.userId)
    const avatarDetails = await client.service('avatar').get(user.avatarId!)

    const avatarSpawnPose = SpawnPoints.instance.getRandomSpawnPoint()
    receiveJoinWorld({
      highResTimeOrigin: performance.timeOrigin,
      worldStartTime: performance.now(),
      client: {
        index: 1,
        name: authState.user.name.value
      },
      cachedActions: [],
      avatarDetail: {
        avatarURL: avatarDetails.avatarURL,
        thumbnailURL: avatarDetails.thumbnailURL!
      },
      avatarSpawnPose
    })
  }

  /** OFFLINE */
  useEffect(() => {
    if (engineState.sceneLoaded.value) {
      const world = Engine.instance.currentWorld
      const userId = authState.authUser.identityProvider.userId.value
      Engine.instance.userId = userId

      Engine.instance.currentWorld._worldHostId = userId
      Engine.instance.currentWorld.networks.set(userId, new Network(userId))

      const index = 1
      world.userIdToUserIndex.set(userId, index)
      world.userIndexToUserId.set(index, userId)
      world.clients.set(userId, {
        userId: userId,
        index: index,
        name: authState.user.name.value,
        subscribedChatUpdates: []
      })

      joinWorld()
    }
  }, [engineState.connectedWorld, engineState.sceneLoaded])

  return <GameServerWarnings />
}

export default OfflineLocation
