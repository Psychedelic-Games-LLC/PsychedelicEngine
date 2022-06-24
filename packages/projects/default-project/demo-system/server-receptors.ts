import { randomInt } from 'crypto'
import { Vector3 } from 'three'

import { UserId } from '@xrengine/common/src/interfaces/UserId'
import { AvatarComponent } from '@xrengine/engine/src/avatar/components/AvatarComponent'
import { AvatarControllerComponent } from '@xrengine/engine/src/avatar/components/AvatarControllerComponent'
import { createAvatarController } from '@xrengine/engine/src/avatar/functions/createAvatar'
import { teleportAvatar } from '@xrengine/engine/src/avatar/functions/moveAvatar'
import { randomVector3 } from '@xrengine/engine/src/common/functions/MathRandomFunctions'
import { createQuaternionProxy, createVector3Proxy } from '@xrengine/engine/src/common/proxies/three'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { Entity } from '@xrengine/engine/src/ecs/classes/Entity'
import {
  addComponent,
  getComponent,
  hasComponent,
  removeComponent
} from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { createEntity, removeEntity } from '@xrengine/engine/src/ecs/functions/EntityFunctions'
import { NetworkObjectAuthorityTag } from '@xrengine/engine/src/networking/components/NetworkObjectAuthorityTag'
import { NetworkObjectComponent } from '@xrengine/engine/src/networking/components/NetworkObjectComponent'
import { WorldNetworkAction } from '@xrengine/engine/src/networking/functions/WorldNetworkAction'
import { ColliderComponent } from '@xrengine/engine/src/physics/components/ColliderComponent'
import { teleportRigidbody } from '@xrengine/engine/src/physics/functions/teleportRigidbody'
import { TransformComponent } from '@xrengine/engine/src/transform/components/TransformComponent'
import { dispatchAction } from '@xrengine/hyperflux'

import { BasketballClientAction } from './BasketballClientAction'
import { BasketballServerAction } from './BasketballServerAction'
import {
  DemoBallShotComponent,
  NetworkedBallComponentTag,
  NetworkedNpcComponent,
  TimedRoamingComponent
} from './components'
import { BALL_FALL_IMPULSE, BALL_FLY_ARC_HEIGHT, BALL_FLY_DURATION } from './constants'
import { serverOwnedNetworkedNpcQuery } from './DemoSystemServer'
import { addBallComponents, addNpc, positionBallForThrow } from './function'

export function throwBallReceptor(
  action: ReturnType<typeof BasketballClientAction.throwBallRelease>,
  world = Engine.instance.currentWorld,
  targetHoopEntity: Entity
) {
  if (!targetHoopEntity) {
    // throw elsewhere?
    // for now just error
    throw new Error('no hoop entity to throw to')
  }
  const networkId = world.createNetworkId()
  const entity = createEntity()
  addComponent(entity, NetworkObjectComponent, {
    ownerId: Engine.instance.userId,
    networkId: networkId,
    prefab: '',
    parameters: {}
  })
  addComponent(entity, NetworkedBallComponentTag, {})
  addComponent(entity, NetworkObjectAuthorityTag, {})

  const position = createVector3Proxy(TransformComponent.position, entity)
  const rotation = createQuaternionProxy(TransformComponent.rotation, entity)
  const scale = createVector3Proxy(TransformComponent.scale, entity)
  const ballTransform = addComponent(entity, TransformComponent, { position, rotation, scale })
  ballTransform.scale.setScalar(1)

  const playerEntity = world.getUserAvatarEntity(action.$from)
  positionBallForThrow(playerEntity, entity)

  const hoopTransform = getComponent(targetHoopEntity, TransformComponent)

  addComponent(entity, DemoBallShotComponent, {
    from: ballTransform.position.clone(),
    to: hoopTransform.position.clone(),
    progress: 0
  })

  dispatchAction(
    BasketballServerAction.spawnBallNetworkObject({
      $to: 'all',
      networkId: networkId
    }),
    [Engine.instance.currentWorld.worldNetwork.hostId]
  )
}

export function thrownBallReceptor(ballEntity, world = Engine.instance.currentWorld) {
  const ballTransform = getComponent(ballEntity, TransformComponent)
  const shotComponent = getComponent(ballEntity, DemoBallShotComponent)
  shotComponent.progress += world.deltaSeconds / BALL_FLY_DURATION
  console.log(`thrown ball ${ballEntity} fly`, shotComponent.progress)

  // calculate trajectory
  if (shotComponent.progress < 1) {
    // ball fly on fake trajectory
    ballTransform.position.lerpVectors(shotComponent.from, shotComponent.to, shotComponent.progress)
    ballTransform.position.y += BALL_FLY_ARC_HEIGHT * Math.sin(shotComponent.progress * Math.PI)
    return
  }

  // progress > 1, ball needs to be destroyed
  // create new physics ball at last position of our ball, and add proper speed to it
  const ballNetwork = getComponent(ballEntity, NetworkObjectComponent)

  const pBall = spawnBall(Engine.instance.userId)
  const collider = getComponent(pBall, ColliderComponent)
  const body = collider.body as PhysX.PxRigidDynamic

  teleportRigidbody(body, ballTransform.position)
  body.addImpulseAtLocalPos(BALL_FALL_IMPULSE, new Vector3())

  dispatchAction(WorldNetworkAction.destroyObject({ networkId: ballNetwork.networkId }), [
    Engine.instance.currentWorld.worldNetwork.hostId
  ])
}

export function spawnBallReceptor(
  action: ReturnType<typeof BasketballClientAction.spawnBall>,
  world = Engine.instance.currentWorld
) {
  spawnBall(action.$from)
}

export function spawnBall(ownerId: UserId) {
  const networkId = Engine.instance.currentWorld.createNetworkId()
  const entity = createEntity()
  addComponent(entity, NetworkObjectComponent, {
    ownerId: ownerId,
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
  return entity
}

export function spawnNpcReceptor(
  action: ReturnType<typeof BasketballClientAction.spawnNPC>,
  world = Engine.instance.currentWorld
) {
  const networkId = Engine.instance.currentWorld.createNetworkId()
  const name = 'player' + networkId
  addNpc(name, networkId, action.avatarDetails).then((npcEntity) => {
    console.log('npcEntity ', npcEntity)
    const network = getComponent(npcEntity, NetworkObjectComponent)
    network.ownerId = Engine.instance.userId
    createAvatarController(npcEntity)
    const avatar = getComponent(npcEntity, AvatarComponent)
    avatar.isGrounded = true

    addComponent(npcEntity, TimedRoamingComponent, {
      timer: 0,
      interval: 5
    })

    dispatchAction(
      BasketballServerAction.spawnNpcNetworkObject({
        $to: 'all',
        networkId: networkId,
        avatarDetails: action.avatarDetails,
        name: name
      }),
      [Engine.instance.currentWorld.worldNetwork.hostId]
    )
  })
}

export function switchAvatarServerReceptor(action: ReturnType<typeof BasketballClientAction.switchAvatarRequest>) {
  console.log('switchAvatarServerReceptor', action)
  const npcs = serverOwnedNetworkedNpcQuery()
  console.log('npcs.length', npcs.length)
  if (!npcs.length) {
    return
  }

  const nextNpcIndex = Math.round(Math.random() * (npcs.length - 1))
  const nextNpc = npcs[nextNpcIndex]
  const nextNpcTransform = getComponent(nextNpc, TransformComponent)

  const userOwnedObjects = Engine.instance.currentWorld.getOwnedNetworkObjects(action.$from)
  userOwnedObjects.forEach((eid) => {
    console.log('eid', hasComponent(eid, AvatarComponent), hasComponent(eid, AvatarControllerComponent))
  })

  const client = Engine.instance.currentWorld.clients.get(action.$from)
  if (!client || !client.avatarDetail)
    throw Error(`Avatar details action received for a client that does not exist: ${action.$from}`)

  const currentUserAvatar = Engine.instance.currentWorld.getUserAvatarEntity(action.$from)
  const currentUserTransform = getComponent(currentUserAvatar, TransformComponent)

  const newUserPosition = nextNpcTransform.position.clone()
  teleportAvatar(nextNpc, currentUserTransform.position)
  // teleportAvatar(currentUserAvatar, nextNpcTransform.position)
  currentUserTransform.position.copy(newUserPosition)

  const nextNpcNetwork = getComponent(nextNpc, NetworkObjectComponent)
  const npcComponent = getComponent(nextNpc, NetworkedNpcComponent)
  const avatarDetails = npcComponent.avatarDetails

  // dispatch avatar changes

  // tell everyone to change switched npc appearance to one user had before switch
  dispatchAction(
    BasketballServerAction.changeNpcAvatar({
      $to: 'all',
      networkId: nextNpcNetwork.networkId,
      avatarDetails: client.avatarDetail
    }),
    [Engine.instance.currentWorld.worldNetwork.hostId]
  )

  // tell requester to change position and appearance, also he will need to send avatarDetails to all
  dispatchAction(
    BasketballServerAction.switchAvatarEntity({
      $to: action.$from,
      avatarDetail: avatarDetails,
      targetPosition: newUserPosition
    }),
    [Engine.instance.currentWorld.worldNetwork.hostId]
  )
}

export function switchAvatarServerReceptor2(action: ReturnType<typeof BasketballClientAction.switchAvatarRequest>) {
  console.log('switchAvatarServerReceptor', action)
  const npcs = serverOwnedNetworkedNpcQuery()
  console.log('npcs.length', npcs.length)
  if (!npcs.length) {
    return
  }

  const nextNpcIndex = Math.round(Math.random() * (npcs.length - 1))
  const nextNpc = npcs[nextNpcIndex]
  const nextNpcTransform = getComponent(nextNpc, TransformComponent)

  // const userOwnedObjects = Engine.instance.currentWorld.getOwnedNetworkObjects(action.$from)
  // userOwnedObjects.forEach(eid => {
  //     console.log('eid', hasComponent(eid, AvatarComponent), hasComponent(eid, AvatarControllerComponent))
  // })
  //
  // const client = Engine.instance.currentWorld.clients.get(action.$from)
  // if (!client || !client.avatarDetail) throw Error(`Avatar details action received for a client that does not exist: ${action.$from}`)
  //
  // const currentUserAvatar = Engine.instance.currentWorld.getUserAvatarEntity(action.$from)
  // const currentUserTransform = getComponent(currentUserAvatar, TransformComponent)
  //
  // const newUserPosition = nextNpcTransform.position.clone()
  // teleportAvatar(nextNpc, currentUserTransform.position)
  // // teleportAvatar(currentUserAvatar, nextNpcTransform.position)
  // currentUserTransform.position.copy(newUserPosition)
  //
  // const nextNpcNetwork = getComponent(nextNpc, NetworkObjectComponent)
  // const npcComponent = getComponent(nextNpc, NetworkedNpcComponent)
  // const avatarDetails = npcComponent.avatarDetails
  //
  // // dispatch avatar changes
  //
  // // tell everyone to change switched npc appearance to one user had before switch
  // dispatchAction(
  //     BasketballServerAction.changeNpcAvatar({
  //         $to: 'all',
  //         networkId: nextNpcNetwork.networkId,
  //         avatarDetails: client.avatarDetail
  //     }),
  //     [Engine.instance.currentWorld.worldNetwork.hostId]
  // )
  //
  // // tell requester to change position and appearance, also he will need to send avatarDetails to all
  // dispatchAction(
  //     BasketballServerAction.switchAvatarEntity({
  //         $to: action.$from,
  //         avatarDetail: avatarDetails,
  //         targetPosition: newUserPosition
  //     }),
  //     [Engine.instance.currentWorld.worldNetwork.hostId]
  // )
}
