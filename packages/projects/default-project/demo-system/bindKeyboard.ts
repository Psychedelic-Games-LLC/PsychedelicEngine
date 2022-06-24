import { AvatarInputSchema } from '@xrengine/engine/src/avatar/AvatarInputSchema'
import { LifecycleValue } from '@xrengine/engine/src/common/enums/LifecycleValue'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { Entity } from '@xrengine/engine/src/ecs/classes/Entity'
import { getComponent, hasComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { InputValue } from '@xrengine/engine/src/input/interfaces/InputValue'
import { InputAlias } from '@xrengine/engine/src/input/types/InputAlias'
import { NetworkObjectAuthorityTag } from '@xrengine/engine/src/networking/components/NetworkObjectAuthorityTag'
import { NetworkObjectComponent } from '@xrengine/engine/src/networking/components/NetworkObjectComponent'
import { networkTransformsQuery } from '@xrengine/engine/src/networking/systems/OutgoingNetworkSystem'
import { accessEngineRendererState, EngineRendererAction } from '@xrengine/engine/src/renderer/EngineRendererState'
import { ModelComponent } from '@xrengine/engine/src/scene/components/ModelComponent'
import { NameComponent } from '@xrengine/engine/src/scene/components/NameComponent'
import { TransformComponent } from '@xrengine/engine/src/transform/components/TransformComponent'
import { dispatchAction } from '@xrengine/hyperflux'

import { BasketballClientAction } from './BasketballClientAction'
import { namedObjectsQuery } from './DemoSystemClient'

enum BasketballInput {
  DEBUG = 9999,
  SPAWN_BALL,
  SPAWN_NPC,
  THRAW_BALL,
  SWITCH_PLAYER
}

export function bindKeyboardMap() {
  AvatarInputSchema.inputMap.set('KeyI', BasketballInput.DEBUG)
  AvatarInputSchema.behaviorMap.set(BasketballInput.DEBUG, debugInputHandler)

  AvatarInputSchema.inputMap.set('KeyQ', BasketballInput.SPAWN_BALL)
  AvatarInputSchema.behaviorMap.set(BasketballInput.SPAWN_BALL, spawnBallInputHandler)

  AvatarInputSchema.inputMap.set('KeyR', BasketballInput.SPAWN_NPC)
  AvatarInputSchema.behaviorMap.set(BasketballInput.SPAWN_NPC, spawnNpcInputHandler)

  AvatarInputSchema.inputMap.set('KeyE', BasketballInput.THRAW_BALL)
  AvatarInputSchema.behaviorMap.set(BasketballInput.THRAW_BALL, throwBallInputHandler)

  AvatarInputSchema.inputMap.set('KeyZ', BasketballInput.SWITCH_PLAYER)
  AvatarInputSchema.behaviorMap.set(BasketballInput.SWITCH_PLAYER, switchPlayerInputHandler)
}

function debugInputHandler(entity: Entity, inputKey: InputAlias, inputValue: InputValue): void {
  if (inputValue.lifecycleState !== LifecycleValue.Ended) return

  console.log('my avatar network object')
  const uae = Engine.instance.currentWorld.getUserAvatarEntity(Engine.instance.userId)
  const uaen = getComponent(uae, NetworkObjectComponent)
  console.log(uaen)

  console.log('all network objects')
  networkTransformsQuery().forEach((e) => {
    const nat = hasComponent(e, NetworkObjectAuthorityTag)
    const name = getComponent(e, NameComponent)
    const nc = getComponent(e, NetworkObjectComponent)
    const tc = getComponent(e, TransformComponent)
    console.log('nc', name?.name, nc.ownerId === Engine.instance.userId ? 'my' : '', {
      nat,
      nid: nc.networkId,
      pos: tc?.position.toArray(),
      rot: tc?.rotation.toArray(),
      scl: tc?.scale.toArray()
    })

    dispatchAction(EngineRendererAction.setPhysicsDebug(!accessEngineRendererState().physicsDebugEnable.value))
  })
}

function spawnBallInputHandler(entity: Entity, inputKey: InputAlias, inputValue: InputValue): void {
  if (inputValue.lifecycleState !== LifecycleValue.Ended) return
  console.log('~~~ !!! ~~~ Throw ball!')
  // console.log('server id?', Engine.instance.currentWorld.worldNetwork.hostId)
  //
  // console.log('world.entityTree', world.entityTree)
  //
  // console.log('namedEntities()', world.namedEntities)

  // // throwRequested = true
  dispatchAction(
    BasketballClientAction.spawnBall({
      $to: Engine.instance.currentWorld.worldNetwork.hostId
    }),
    [Engine.instance.currentWorld.worldNetwork.hostId]
  )
}

function spawnNpcInputHandler(entity: Entity, inputKey: InputAlias, inputValue: InputValue): void {
  if (inputValue.lifecycleState !== LifecycleValue.Ended) return

  const playerModelEntity = namedObjectsQuery().find((e) => {
    const { name } = getComponent(e, NameComponent)
    return name === 'mixamo model'
  })
  if (!playerModelEntity) {
    console.error('failed to get player model entity')
    return
  }
  const { src } = getComponent(playerModelEntity, ModelComponent)
  const avatarDetails = {
    avatarURL: src,
    thumbnailURL: src + '.png'
  }

  console.log('~~~ !!! ~~~ Add NPC!', avatarDetails)
  dispatchAction(
    BasketballClientAction.spawnNPC({
      $to: Engine.instance.currentWorld.worldNetwork.hostId,
      avatarDetails
    }),
    [Engine.instance.currentWorld.worldNetwork.hostId]
  )
}

function switchPlayerInputHandler(entity: Entity, inputKey: InputAlias, inputValue: InputValue): void {
  if (inputValue.lifecycleState !== LifecycleValue.Ended) return
  dispatchAction(
    BasketballClientAction.switchAvatarRequest({
      $to: Engine.instance.currentWorld.worldNetwork.hostId
    }),
    [Engine.instance.currentWorld.worldNetwork.hostId]
  )
}

function throwBallInputHandler(entity: Entity, inputKey: InputAlias, inputValue: InputValue): void {
  if (inputValue.lifecycleState !== LifecycleValue.Ended) return
  dispatchAction(
    BasketballClientAction.throwBallRelease({
      $to: Engine.instance.currentWorld.worldNetwork.hostId
    }),
    [Engine.instance.currentWorld.worldNetwork.hostId]
  )
}
