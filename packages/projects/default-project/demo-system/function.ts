import { randomInt } from 'crypto'
import { Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereBufferGeometry, Vector3 } from 'three'

import { UserId } from '@xrengine/common/src/interfaces/UserId'
import { AudioTagComponent } from '@xrengine/engine/src/audio/components/AudioTagComponent'
import { AvatarComponent } from '@xrengine/engine/src/avatar/components/AvatarComponent'
import { AvatarControllerComponent } from '@xrengine/engine/src/avatar/components/AvatarControllerComponent'
import {
  loadAvatarModelAsset,
  loadGrowingEffectObject,
  setupAvatarHeight,
  setupAvatarMaterials,
  setupAvatarModel
} from '@xrengine/engine/src/avatar/functions/avatarFunctions'
import { createAvatar } from '@xrengine/engine/src/avatar/functions/createAvatar'
import {
  FollowCameraComponent,
  FollowCameraDefaultValues
} from '@xrengine/engine/src/camera/components/FollowCameraComponent'
import { isClient } from '@xrengine/engine/src/common/functions/isClient'
import { randomNumber, randomVector3 } from '@xrengine/engine/src/common/functions/MathRandomFunctions'
import { createQuaternionProxy, createVector3Proxy } from '@xrengine/engine/src/common/proxies/three'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { Entity } from '@xrengine/engine/src/ecs/classes/Entity'
import { addComponent, getComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { createEntity } from '@xrengine/engine/src/ecs/functions/EntityFunctions'
import { LocalInputTagComponent } from '@xrengine/engine/src/input/components/LocalInputTagComponent'
import { NetworkObjectAuthorityTag } from '@xrengine/engine/src/networking/components/NetworkObjectAuthorityTag'
import { NetworkObjectComponent } from '@xrengine/engine/src/networking/components/NetworkObjectComponent'
import { WorldNetworkAction } from '@xrengine/engine/src/networking/functions/WorldNetworkAction'
import { AvatarProps } from '@xrengine/engine/src/networking/interfaces/WorldState'
import { ColliderComponent } from '@xrengine/engine/src/physics/components/ColliderComponent'
import { CollisionComponent } from '@xrengine/engine/src/physics/components/CollisionComponent'
import { VelocityComponent } from '@xrengine/engine/src/physics/components/VelocityComponent'
import { CollisionGroups } from '@xrengine/engine/src/physics/enums/CollisionGroups'
import { BodyType } from '@xrengine/engine/src/physics/types/PhysicsTypes'
import { ShadowComponent } from '@xrengine/engine/src/scene/components/ShadowComponent'
import { VisibleComponent } from '@xrengine/engine/src/scene/components/VisibleComponent'
import { TransformComponent } from '@xrengine/engine/src/transform/components/TransformComponent'

import { NetworkedBallComponentTag, NetworkedNpcComponent, TimedRoamingComponent } from './components'
import { BALL_PLAYER_BOUNCE_DISTANCE, FORWARD } from './constants'

export function addBallComponents(entity: Entity, server: boolean) {
  const world = Engine.instance.currentWorld

  if (server) {
    addComponent(entity, CollisionComponent, { collisions: [] })

    const shape = world.physics.createShape(
      new PhysX.PxSphereGeometry(0.12),
      world.physics.physics.createMaterial(1, 1, 0.8),
      {
        collisionLayer: CollisionGroups.Default,
        collisionMask:
          CollisionGroups.Default | CollisionGroups.Avatars | CollisionGroups.Ground | CollisionGroups.Trigger
      }
    )

    let translation
    if (server) {
      translation = {
        x: randomNumber(-1, 1),
        y: randomNumber(1, 3),
        z: randomNumber(-1, 1)
      }
    } else {
      translation = {
        x: 0,
        y: 1,
        z: 0
      }
    }

    const body = world.physics.addBody({
      shapes: [shape],
      // mass: 0.01,
      type: BodyType.DYNAMIC,
      transform: {
        translation: translation,
        rotation: new Quaternion()
      },
      userData: {
        entity
      }
    }) as PhysX.PxRigidDynamic
    body.setActorFlag(PhysX.PxActorFlag.eDISABLE_GRAVITY, !server)
    addComponent(entity, ColliderComponent, { body })

    addComponent(entity, NetworkObjectAuthorityTag, {})
    const defaultTorqueForce = randomVector3(500)
    body.addTorque(defaultTorqueForce)
  }

  // addComponent(entity, Object3DComponent, { value: ballMesh.clone() })
  const position = createVector3Proxy(TransformComponent.position, entity)
  const rotation = createQuaternionProxy(TransformComponent.rotation, entity)
  const scale = createVector3Proxy(TransformComponent.scale, entity)

  const transform = addComponent(entity, TransformComponent, { position, rotation, scale })
  transform.scale.setScalar(1)
  const linearVelocity = createVector3Proxy(VelocityComponent.linear, entity)
  const angularVelocity = createVector3Proxy(VelocityComponent.angular, entity)

  addComponent(entity, VelocityComponent, {
    linear: linearVelocity,
    angular: angularVelocity
  })
  addComponent(entity, VisibleComponent, {})
  addComponent(entity, NetworkedBallComponentTag, {})

  // addComponent(entity, TimedBounceComponent, {
  //     timer: 0,
  //     interval: 5,
  // })
}

export async function addNpc(key: string, networkId, avatarDetails?: AvatarProps): Promise<Entity> {
  const position = randomVector3(3)
  position.y = 0
  console.log('addNpc', key, networkId, position.toArray())
  const spawnAction = WorldNetworkAction.spawnAvatar({
    $from: key as UserId,
    networkId: networkId,
    prefab: 'avatar',
    parameters: {
      position: position,
      rotation: new Quaternion()
    }
  })

  const entity = createEntity(Engine.instance.currentWorld)
  const nc = addComponent(entity, NetworkObjectComponent, {
    ownerId: spawnAction.$from,
    networkId: networkId,
    prefab: 'npc',
    parameters: {}
  })

  createAvatar(spawnAction)

  addComponent(entity, NetworkedNpcComponent, {
    avatarDetails
  })
  if (isClient) {
    addComponent(entity, AudioTagComponent, {})
    addComponent(entity, ShadowComponent, { receiveShadow: true, castShadow: true })

    if (avatarDetails) {
      loadAvatarForUser(entity, avatarDetails.avatarURL)
    }
    // if (spawnAction.$from === Engine.instance.userId) {
    //     addComponent(entity, LocalInputTagComponent, {})
    //     addComponent(entity, FollowCameraComponent, FollowCameraDefaultValues)
    // }
  } else {
    addComponent(entity, NetworkObjectAuthorityTag, {})
  }

  console.log('return ', entity)
  return entity
}

export const loadAvatarForUser = async (entity: Entity, avatarURL: string) => {
  const avatarModel = await loadAvatarModelAsset(avatarURL)
  setupAvatarForUser(entity, avatarModel)
}

export const setupAvatarForUser = (entity: Entity, model: Object3D) => {
  const avatar = getComponent(entity, AvatarComponent)
  avatar.modelContainer.clear()

  setupAvatarModel(entity)(model)
  setupAvatarHeight(entity, model)

  // const avatarMaterials = setupAvatarMaterials(entity, model)

  // Materials only load on the client currently
  // if (isClient) {
  //   loadGrowingEffectObject(entity, avatarMaterials)
  // }

  model.children.forEach((child) => avatar.modelContainer.add(child))
}

export function updateRoamingNpcs(entity, deltaSeconds) {
  const roaming = getComponent(entity, TimedRoamingComponent)
  if (typeof roaming.timer === 'undefined') {
    roaming.timer = 0
  }
  roaming.timer -= deltaSeconds

  const velocity = getComponent(entity, VelocityComponent)
  const transform = getComponent(entity, TransformComponent)
  transform.position.add(velocity.linear)

  if (roaming.timer > 0) {
    return
  }
  console.log('change velocity!')
  // time to change velocity
  roaming.timer = roaming.interval

  // const velocity = getComponent(entity, VelocityComponent)
  // velocity.linear.set(
  //     randomNumber(-6,6),
  //     0,
  //     randomNumber(-6,6)
  // )

  const controller = getComponent(entity, AvatarControllerComponent)
  controller.localMovementDirection.set(randomNumber(-1, 1), 0, randomNumber(-1, 1)).normalize()
  // controller.isWalking = controller.localMovementDirection.length() < 0.5
  controller.isWalking = Math.random() < 0.5

  transform.rotation.setFromUnitVectors(FORWARD, controller.localMovementDirection)
}

export function positionBallForThrow(playerEntity, ballEntity) {
  const avatar = getComponent(playerEntity, AvatarComponent)
  const avatarTransform = getComponent(playerEntity, TransformComponent)
  const ballTransform = getComponent(ballEntity, TransformComponent)

  const BALL_PLAYER_BOUNCE_HEIGHT = avatar.avatarHeight * 0.8

  const ballPosition = ballTransform.position
  ballPosition.set(0, BALL_PLAYER_BOUNCE_HEIGHT, BALL_PLAYER_BOUNCE_DISTANCE)
  ballPosition.applyQuaternion(avatarTransform.rotation)
  ballPosition.add(avatarTransform.position)
}
