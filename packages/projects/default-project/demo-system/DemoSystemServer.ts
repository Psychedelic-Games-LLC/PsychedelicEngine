import { Material, Mesh, MeshStandardMaterial, Quaternion, SphereBufferGeometry, Vector3 } from 'three'
import { randInt } from 'three/src/math/MathUtils'

import { AvatarInputSchema } from '@xrengine/engine/src/avatar/AvatarInputSchema'
import { AvatarComponent } from '@xrengine/engine/src/avatar/components/AvatarComponent'
import { createAvatarController, defaultAvatarHalfHeight } from '@xrengine/engine/src/avatar/functions/createAvatar'
import { LifecycleValue } from '@xrengine/engine/src/common/enums/LifecycleValue'
import { randomNumber, randomVector3 } from '@xrengine/engine/src/common/functions/MathRandomFunctions'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { Entity } from '@xrengine/engine/src/ecs/classes/Entity'
import { World } from '@xrengine/engine/src/ecs/classes/World'
import {
  addComponent,
  createMappedComponent,
  defineQuery,
  getComponent,
  removeComponent
} from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { createEntity } from '@xrengine/engine/src/ecs/functions/EntityFunctions'
import { InputValue } from '@xrengine/engine/src/input/interfaces/InputValue'
import { InputAlias } from '@xrengine/engine/src/input/types/InputAlias'
import { NetworkObjectComponent } from '@xrengine/engine/src/networking/components/NetworkObjectComponent'
import { WorldNetworkAction } from '@xrengine/engine/src/networking/functions/WorldNetworkAction'
import { ColliderComponent } from '@xrengine/engine/src/physics/components/ColliderComponent'
import { VelocityComponent } from '@xrengine/engine/src/physics/components/VelocityComponent'
import { CollisionGroups } from '@xrengine/engine/src/physics/enums/CollisionGroups'
import {
  boxDynamicConfig,
  generatePhysicsObject
} from '@xrengine/engine/src/physics/functions/physicsObjectDebugFunctions'
import { teleportRigidbody } from '@xrengine/engine/src/physics/functions/teleportRigidbody'
import { BodyType, ColliderTypes } from '@xrengine/engine/src/physics/types/PhysicsTypes'
import { Object3DComponent } from '@xrengine/engine/src/scene/components/Object3DComponent'
import { TriggerVolumeComponent } from '@xrengine/engine/src/scene/components/TriggerVolumeComponent'
import { VisibleComponent } from '@xrengine/engine/src/scene/components/VisibleComponent'
import { TransformComponent } from '@xrengine/engine/src/transform/components/TransformComponent'
import { createActionQueue, dispatchAction } from '@xrengine/hyperflux'

import { BasketballClientAction } from './BasketballClientAction'
import { BasketballServerAction } from './BasketballServerAction'
import {
  NetworkedBallComponentTag,
  NetworkedNpcComponentTag,
  TimedBounceComponent,
  TimedRoamingComponent
} from './components'
import { addBallComponents, addNpc, updateRoamingNpcs } from './function'

function throwBallReceptor(
  action: ReturnType<typeof BasketballClientAction.throw>,
  world = Engine.instance.currentWorld
) {
  const networkId = Engine.instance.currentWorld.createNetworkId()
  const entity = createEntity()
  addComponent(entity, NetworkObjectComponent, {
    ownerId: action.$from,
    networkId: networkId,
    prefab: 'zzz',
    parameters: {}
  })

  addBallComponents(entity, true)

  dispatchAction(
    BasketballServerAction.spawnBallNetworkObject({
      $to: 'all',
      networkId: networkId
    }),
    [Engine.instance.currentWorld.worldNetwork.hostId]
  )
}

function spawnNpcReceptor(
  action: ReturnType<typeof BasketballClientAction.spawnNPC>,
  world = Engine.instance.currentWorld
) {
  const networkId = Engine.instance.currentWorld.createNetworkId()
  const name = 'player' + networkId
  addNpc(name, networkId).then((npcEntity) => {
    console.log('npcEntity ', npcEntity)
    const network = getComponent(npcEntity, NetworkObjectComponent)
    network.ownerId = Engine.instance.userId
    createAvatarController(npcEntity)
    const avatar = getComponent(npcEntity, AvatarComponent)
    avatar.isGrounded = true

    addComponent(npcEntity, TimedRoamingComponent, {
      interval: 5
    })

    dispatchAction(
      BasketballServerAction.spawnNpcNetworkObject({
        $to: 'all',
        networkId: networkId,
        name: name
      }),
      [Engine.instance.currentWorld.worldNetwork.hostId]
    )
  })
}

const timedBounceQuery = defineQuery([TimedBounceComponent, ColliderComponent])
const networkedBallsQuery = defineQuery([NetworkedBallComponentTag, NetworkObjectComponent])
const networkedNpcQuery = defineQuery([NetworkedNpcComponentTag, NetworkObjectComponent])
const roamingQuery = defineQuery([TimedRoamingComponent, NetworkedNpcComponentTag, NetworkObjectComponent])

export default async function DemoSystemServer(world: World) {
  const throwballQueue = createActionQueue(BasketballClientAction.throw.matches)
  const spawnNpcQueue = createActionQueue(BasketballClientAction.spawnNPC.matches)
  const newClientsQueue = createActionQueue(WorldNetworkAction.createClient.matches)

  return () => {
    const { deltaSeconds } = world

    for (const throwballQueueElement of throwballQueue()) {
      throwBallReceptor(throwballQueueElement)
    }
    for (const spawnNpcQueueElement of spawnNpcQueue()) {
      spawnNpcReceptor(spawnNpcQueueElement)
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
