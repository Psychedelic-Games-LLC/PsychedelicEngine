import { Mesh, MeshStandardMaterial } from 'three'

import { UserId } from '@xrengine/common/src/interfaces/UserId'
import { teleportAvatar } from '@xrengine/engine/src/avatar/functions/moveAvatar'
import {
  FollowCameraComponent,
  FollowCameraDefaultValues
} from '@xrengine/engine/src/camera/components/FollowCameraComponent'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { Entity } from '@xrengine/engine/src/ecs/classes/Entity'
import { addComponent, getComponent, removeComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { createEntity } from '@xrengine/engine/src/ecs/functions/EntityFunctions'
import { LocalInputTagComponent } from '@xrengine/engine/src/input/components/LocalInputTagComponent'
import { NetworkObjectAuthorityTag } from '@xrengine/engine/src/networking/components/NetworkObjectAuthorityTag'
import { NetworkObjectComponent } from '@xrengine/engine/src/networking/components/NetworkObjectComponent'
import { WorldNetworkAction } from '@xrengine/engine/src/networking/functions/WorldNetworkAction'
import { Object3DComponent } from '@xrengine/engine/src/scene/components/Object3DComponent'
import { dispatchAction } from '@xrengine/hyperflux'

import { BasketballServerAction } from './BasketballServerAction'
import { addBallComponents, addNpc, loadAvatarForUser } from './function'

export function spawnBallReceptor(
  action: ReturnType<typeof BasketballServerAction.spawnBallNetworkObject>,
  ballModelEntity: Entity
) {
  const entity = createEntity()
  addComponent(entity, NetworkObjectComponent, {
    ownerId: action.$from,
    networkId: action.networkId,
    prefab: 'zzz',
    parameters: {}
  })

  addBallComponents(entity, false)

  const { value: ballObject } = getComponent(ballModelEntity, Object3DComponent)
  console.log(ballObject.children[1])
  // @ts-ignore
  ;((ballObject.children[1] as Mesh).material as MeshStandardMaterial).color.setHex(0xca4f38)
  // const ball = new Group()
  // ball.add(ballObject.children[1].clone())

  addComponent(entity, Object3DComponent, {
    value: ballObject.clone(true)
  })
}

export function spawnNpcReceptor(action: ReturnType<typeof BasketballServerAction.spawnNpcNetworkObject>) {
  // addComponent(entity, NetworkObjectComponent, {
  //   ownerId: action.$from,
  //   networkId: action.networkId,
  //   prefab: 'zzz',
  //   parameters: {}
  // })

  addNpc(action.name, action.networkId, action.avatarDetails).then((npcEntity) => {
    const network = getComponent(npcEntity, NetworkObjectComponent)
    network.ownerId = action.$from
  })
}

export function changeNpcAvatarReceptor(action: ReturnType<typeof BasketballServerAction.changeNpcAvatar>) {
  const world = Engine.instance.currentWorld
  const npcEntity = world.getNetworkObject(action.$from, action.networkId)
  if (!npcEntity) {
    return
  }
  loadAvatarForUser(npcEntity, action.avatarDetails.avatarURL)
}

export function switchAvatarReceptor(action: ReturnType<typeof BasketballServerAction.switchAvatarEntity>) {
  const { targetPosition, avatarDetail } = action
  const world = Engine.instance.currentWorld
  const currentUserId = Engine.instance.userId
  const serverId = action.$from
  console.log('switchAvatarReceptor', action, currentUserId)

  const currentAvatarEntity = world.getUserAvatarEntity(Engine.instance.userId)
  teleportAvatar(currentAvatarEntity, targetPosition)

  // propagate my new appearance
  dispatchAction(WorldNetworkAction.avatarDetails({ avatarDetail: avatarDetail }), [
    Engine.instance.currentWorld.worldNetwork.hostId
  ])
}
