import { randomInt } from 'crypto'

import { randomVector3 } from '@xrengine/engine/src/common/functions/MathRandomFunctions'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { World } from '@xrengine/engine/src/ecs/classes/World'
import { defineQuery, getComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { NetworkObjectAuthorityTag } from '@xrengine/engine/src/networking/components/NetworkObjectAuthorityTag'
import { NetworkObjectComponent } from '@xrengine/engine/src/networking/components/NetworkObjectComponent'
import { WorldNetworkAction } from '@xrengine/engine/src/networking/functions/WorldNetworkAction'
import { ColliderComponent } from '@xrengine/engine/src/physics/components/ColliderComponent'
import { TriggerVolumeComponent } from '@xrengine/engine/src/scene/components/TriggerVolumeComponent'
import { TransformComponent } from '@xrengine/engine/src/transform/components/TransformComponent'
import { createActionQueue, dispatchAction } from '@xrengine/hyperflux'

import { BasketballClientAction } from './BasketballClientAction'
import { BasketballServerAction } from './BasketballServerAction'
import {
  DemoBallComponent,
  DemoBallShotComponent,
  NetworkedBallComponentTag,
  NetworkedNpcComponent,
  TimedBounceComponent,
  TimedRoamingComponent
} from './components'
import { updateRoamingNpcs } from './function'
import {
  spawnBallReceptor,
  spawnNpcReceptor,
  switchAvatarServerReceptor,
  throwBallReceptor,
  thrownBallReceptor
} from './server-receptors'

const triggerVolumesQuery = defineQuery([TriggerVolumeComponent, TransformComponent])
const timedBounceQuery = defineQuery([TimedBounceComponent, ColliderComponent])
const networkedBallsQuery = defineQuery([NetworkedBallComponentTag, NetworkObjectComponent])
const networkedNpcQuery = defineQuery([NetworkedNpcComponent, NetworkObjectComponent])
export const serverOwnedNetworkedNpcQuery = defineQuery([
  NetworkedNpcComponent,
  NetworkObjectComponent,
  NetworkObjectAuthorityTag
])
const roamingQuery = defineQuery([TimedRoamingComponent, NetworkedNpcComponent, NetworkObjectComponent])
const thrownBallQuery = defineQuery([DemoBallShotComponent, NetworkedBallComponentTag, NetworkObjectComponent])

export default async function DemoSystemServer(world: World) {
  const throwBallQueue = createActionQueue(BasketballClientAction.throwBallRelease.matches)
  const spawnBallQueue = createActionQueue(BasketballClientAction.spawnBall.matches)
  const spawnNpcQueue = createActionQueue(BasketballClientAction.spawnNPC.matches)
  const newClientsQueue = createActionQueue(WorldNetworkAction.createClient.matches)
  const switchAvatarQueue = createActionQueue(BasketballClientAction.switchAvatarRequest.matches)

  return () => {
    const { deltaSeconds } = world

    for (const throwBallQueueElement of throwBallQueue()) {
      throwBallReceptor(throwBallQueueElement, world, triggerVolumesQuery()?.[0])
    }
    for (const entity of thrownBallQuery()) thrownBallReceptor(entity)

    for (const spawnBallQueueElement of spawnBallQueue()) {
      spawnBallReceptor(spawnBallQueueElement)
    }
    for (const spawnNpcQueueElement of spawnNpcQueue()) {
      spawnNpcReceptor(spawnNpcQueueElement)
    }

    for (const switchAction of switchAvatarQueue()) {
      switchAvatarServerReceptor(switchAction)
    }

    for (const action of newClientsQueue()) {
      for (const ball of networkedBallsQuery()) {
        const { networkId } = getComponent(ball, NetworkObjectComponent)
        dispatchAction(
          BasketballServerAction.spawnBallNetworkObject({
            $to: action.$from,
            networkId: networkId
          }),
          [Engine.instance.currentWorld.worldNetwork.hostId]
        )
      }
    }

    for (const npcEntity of roamingQuery()) updateRoamingNpcs(npcEntity, world.deltaSeconds)

    for (const entity of timedBounceQuery()) {
      const bounce = getComponent(entity, TimedBounceComponent)
      bounce.timer -= deltaSeconds
      if (bounce.timer > 0) {
        continue
      }
      console.log('Bounce!')
      // bounce time
      bounce.timer = bounce.interval

      const collider = getComponent(entity, ColliderComponent)
      const body = collider.body as PhysX.PxRigidDynamic

      // teleportRigidbody(body, randomVector3(4).setY(3))

      const defaultTorqueForce = randomVector3(500)
      body.addTorque(defaultTorqueForce)

      // body.addImpulseAtLocalPos(randomVector3(25), new Vector3())

      // const linearVelocity = getComponent(entity, VelocityComponent).linear
      // linearVelocity.copy(randomVector3(3))
      // if (linearVelocity.y < 0) {
      //   linearVelocity.y *= -1
      // }
      // const angularVelocity = getComponent(entity, VelocityComponent).angular

      // const transform = getComponent(entity, TransformComponent)
      // console.log('bounce scale', transform.scale.toArray())
      // transform.position.copy(randomVector3(3))
      // transform.position.y = 3
      // console.log('bounced to ', transform.position.toArray())
    }
  }
}
