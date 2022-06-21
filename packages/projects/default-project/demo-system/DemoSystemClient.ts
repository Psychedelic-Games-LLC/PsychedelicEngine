import { Group, Material, Mesh, MeshStandardMaterial, Quaternion, SphereBufferGeometry, Vector3 } from 'three'

import { NetworkId } from '@xrengine/common/src/interfaces/NetworkId'
import { AvatarInputSchema } from '@xrengine/engine/src/avatar/AvatarInputSchema'
import { AvatarComponent } from '@xrengine/engine/src/avatar/components/AvatarComponent'
import { LifecycleValue } from '@xrengine/engine/src/common/enums/LifecycleValue'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { Entity } from '@xrengine/engine/src/ecs/classes/Entity'
import { World } from '@xrengine/engine/src/ecs/classes/World'
import {
  addComponent,
  createMappedComponent,
  defineQuery,
  getComponent,
  hasComponent,
  removeComponent
} from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { createEntity } from '@xrengine/engine/src/ecs/functions/EntityFunctions'
import { InputValue } from '@xrengine/engine/src/input/interfaces/InputValue'
import { InputAlias } from '@xrengine/engine/src/input/types/InputAlias'
import { NetworkObjectAuthorityTag } from '@xrengine/engine/src/networking/components/NetworkObjectAuthorityTag'
import { NetworkObjectComponent } from '@xrengine/engine/src/networking/components/NetworkObjectComponent'
import { WorldNetworkAction } from '@xrengine/engine/src/networking/functions/WorldNetworkAction'
import { networkTransformsQuery } from '@xrengine/engine/src/networking/systems/OutgoingNetworkSystem'
import { VelocityComponent } from '@xrengine/engine/src/physics/components/VelocityComponent'
import { CollisionGroups } from '@xrengine/engine/src/physics/enums/CollisionGroups'
import {
  boxDynamicConfig,
  generatePhysicsObject
} from '@xrengine/engine/src/physics/functions/physicsObjectDebugFunctions'
import { BodyType, ColliderTypes } from '@xrengine/engine/src/physics/types/PhysicsTypes'
import { accessEngineRendererState, EngineRendererAction } from '@xrengine/engine/src/renderer/EngineRendererState'
import { AssetComponent, AssetLoadedComponent } from '@xrengine/engine/src/scene/components/AssetComponent'
import { ModelComponent } from '@xrengine/engine/src/scene/components/ModelComponent'
import { NameComponent } from '@xrengine/engine/src/scene/components/NameComponent'
import { Object3DComponent } from '@xrengine/engine/src/scene/components/Object3DComponent'
import { TriggerVolumeComponent } from '@xrengine/engine/src/scene/components/TriggerVolumeComponent'
import { VisibleComponent } from '@xrengine/engine/src/scene/components/VisibleComponent'
import { TransformComponent } from '@xrengine/engine/src/transform/components/TransformComponent'
import { createActionQueue, dispatchAction } from '@xrengine/hyperflux'

import { TournamentAction } from '../tournament/receptor/action'
import { BasketballClientAction } from './BasketballClientAction'
import { BasketballServerAction } from './BasketballServerAction'
import { DemoBallComponent, DemoBallShotComponent, NetworkedNpcComponentTag } from './components'
import { addBallComponents, addNpc } from './function'

//import { AssetLoader } from '@xrengine/engine/src/assets/classes/AssetLoader'

const ballMaterial = new MeshStandardMaterial({ color: '#ca4f38' })
const ballGeometry = new SphereBufferGeometry(0.15, 16, 12)
const ballMesh = new Mesh(ballGeometry, ballMaterial)

const BALL_PLAYER_BOUNCE_DISTANCE = 0.35
const BALL_BOUNCE_SPEED = 1
const BALL_FLY_SPEED = 1

function positionBallBesidePlayer(playerEntity, ballEntity) {
  const avatar = getComponent(playerEntity, AvatarComponent)
  const avatarTransform = getComponent(playerEntity, TransformComponent)
  const ballTransform = getComponent(ballEntity, TransformComponent)
  const ballComponent = getComponent(ballEntity, DemoBallComponent)

  const BALL_PLAYER_BOUNCE_HEIGHT = avatar.avatarHeight * 0.5

  // very simple bouncing
  const bouncePositionY = BALL_PLAYER_BOUNCE_HEIGHT * Math.abs(Math.sin(ballComponent.progress * Math.PI))

  const ballPosition = ballTransform.position
  ballPosition.set(-BALL_PLAYER_BOUNCE_DISTANCE, bouncePositionY, BALL_PLAYER_BOUNCE_DISTANCE)
  ballPosition.applyQuaternion(avatarTransform.rotation)
  ballPosition.add(avatarTransform.position)
}

function positionBallForThrow(playerEntity, ballEntity) {
  const avatar = getComponent(playerEntity, AvatarComponent)
  const avatarTransform = getComponent(playerEntity, TransformComponent)
  const ballTransform = getComponent(ballEntity, TransformComponent)

  const BALL_PLAYER_BOUNCE_HEIGHT = avatar.avatarHeight * 0.8

  const ballPosition = ballTransform.position
  ballPosition.set(0, BALL_PLAYER_BOUNCE_HEIGHT, BALL_PLAYER_BOUNCE_DISTANCE)
  ballPosition.applyQuaternion(avatarTransform.rotation)
  ballPosition.add(avatarTransform.position)
}

function spawnBall(world, playerEntity) {
  // spawn ball
  const ballEntity = createEntity(world)
  addComponent(ballEntity, DemoBallComponent, { state: 'player-bouncing', progress: 0 })
  addComponent(ballEntity, Object3DComponent, { value: ballMesh.clone() })
  addComponent(ballEntity, TransformComponent, {
    position: new Vector3(),
    rotation: new Quaternion(),
    scale: new Vector3(1, 1, 1)
  })
  addComponent(ballEntity, VisibleComponent, {})
}

function spawnBallReceptor(
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

function spawnNpcReceptor(action: ReturnType<typeof BasketballServerAction.spawnNpcNetworkObject>, modelURL) {
  // addComponent(entity, NetworkObjectComponent, {
  //   ownerId: action.$from,
  //   networkId: action.networkId,
  //   prefab: 'zzz',
  //   parameters: {}
  // })

  addNpc(action.name, action.networkId, modelURL).then((npcEntity) => {
    const network = getComponent(npcEntity, NetworkObjectComponent)
    network.ownerId = action.$from
  })
}

const triggerVolumesQuery = defineQuery([TriggerVolumeComponent, TransformComponent])
const playerQuery = defineQuery([AvatarComponent, TransformComponent])
const ballQuery = defineQuery([DemoBallComponent, Object3DComponent])
const firedBallQuery = defineQuery([DemoBallShotComponent, Object3DComponent])
const objectsQuery = defineQuery([Object3DComponent])
const namedObjectsQuery = defineQuery([NameComponent, Object3DComponent])
const npcObjectsQuery = defineQuery([NetworkedNpcComponentTag, TransformComponent, VelocityComponent])

export default async function DemoSystemClient(world: World) {
  // await Promise.all([AssetLoader.loadAsync('/ball.fbx')])
  const spawnballQueue = createActionQueue(BasketballServerAction.spawnBallNetworkObject.matches)
  const spawnNpcQueue = createActionQueue(BasketballServerAction.spawnNpcNetworkObject.matches)
  let throwRequested = false

  // console.log('---- WEBSOCKET ADD ----')
  // const websocket = new WebSocket(`wss://hgew09uvxi.execute-api.us-west-2.amazonaws.com/production`)
  // websocket.onopen = function (evt) {
  //   console.log('---- WEBSOCKET IS OPEN -----')
  // };
  //
  // websocket.onmessage = function (evt) {
  //   console.log('---- WEBSOCKET MESSAGE -----', evt)
  // };
  //
  // websocket.onerror = function (evt) {
  //   console.error('---- WEBSOCKET ERROR -----', evt)
  // };
  // console.log("WEBSOCKET", websocket)

  AvatarInputSchema.inputMap.set('KeyI', 9998)
  AvatarInputSchema.behaviorMap.set(9998, (entity: Entity, inputKey: InputAlias, inputValue: InputValue): void => {
    if (inputValue.lifecycleState !== LifecycleValue.Ended) return

    console.log('all network objects')
    networkTransformsQuery().forEach((e) => {
      const nat = hasComponent(e, NetworkObjectAuthorityTag)
      const name = getComponent(e, NameComponent)
      const nc = getComponent(e, NetworkObjectComponent)
      const tc = getComponent(e, TransformComponent)
      console.log(
        'nc',
        name?.name,
        nat,
        nc.networkId,
        tc?.position.toArray(),
        tc?.rotation.toArray(),
        tc?.scale.toArray()
      )

      dispatchAction(EngineRendererAction.setPhysicsDebug(!accessEngineRendererState().physicsDebugEnable.value))
    })
  })

  AvatarInputSchema.inputMap.set('KeyQ', 9999)
  AvatarInputSchema.behaviorMap.set(9999, (entity: Entity, inputKey: InputAlias, inputValue: InputValue): void => {
    if (inputValue.lifecycleState !== LifecycleValue.Ended) return
    console.log('~~~ !!! ~~~ Throw ball!')
    // console.log('server id?', Engine.instance.currentWorld.worldNetwork.hostId)
    //
    // console.log('world.entityTree', world.entityTree)
    //
    // console.log('namedEntities()', world.namedEntities)

    // // throwRequested = true
    dispatchAction(
      BasketballClientAction.throw({
        $to: Engine.instance.currentWorld.worldNetwork.hostId
      }),
      [Engine.instance.currentWorld.worldNetwork.hostId]
    )
  })

  AvatarInputSchema.inputMap.set('KeyR', 10000)
  AvatarInputSchema.behaviorMap.set(10000, (entity: Entity, inputKey: InputAlias, inputValue: InputValue): void => {
    if (inputValue.lifecycleState !== LifecycleValue.Ended) return
    console.log('~~~ !!! ~~~ Add NPC!')
    dispatchAction(
      BasketballClientAction.spawnNPC({
        $to: Engine.instance.currentWorld.worldNetwork.hostId
      }),
      [Engine.instance.currentWorld.worldNetwork.hostId]
    )
  })

  // playerQuery.enter(world) always returns player. not just on enter
  let ballIsSpawned = false

  const socketInterval = 50 / 1000
  let socketTimer = 0

  return () => {
    const { deltaSeconds } = world

    // socketTimer -= deltaSeconds
    // if (socketTimer <= 0) {
    //   for (const npc of npcObjectsQuery()) {
    //     const network = getComponent(npc, NetworkObjectComponent)
    //     const transform = getComponent(npc, TransformComponent)
    //
    //     const currentPlayerData = {
    //       game_id: 1,
    //       team_id: 1,
    //       player_id: network.networkId,
    //       player_score: '1',
    //       X_position: transform.position.x,
    //       Y_position: transform.position.y,
    //       Z_position: transform.position.z,
    //       Y_rotation: '0',
    //       action: 'running-dribble',
    //       active: true
    //     };
    //     websocket.send(JSON.stringify(currentPlayerData));
    //   }
    //   socketTimer = socketInterval
    // }

    for (const spawnballQueueElement of spawnballQueue()) {
      const ballModelEntity = namedObjectsQuery().find((e) => {
        const { name } = getComponent(e, NameComponent)
        return name === 'BallModel'
      })
      spawnBallReceptor(spawnballQueueElement, ballModelEntity)
    }
    for (const action of spawnNpcQueue()) {
      const playerModelEntity = namedObjectsQuery().find((e) => {
        const { name } = getComponent(e, NameComponent)
        return name === 'mixamo model'
      })
      const { src } = getComponent(playerModelEntity, ModelComponent)
      spawnNpcReceptor(action, src)
    }

    const hoopEntity = triggerVolumesQuery(world)[0]
    const playerEntity = playerQuery(world)[0]
    const ballEntity = ballQuery(world)[0]

    // if (playerEntity && !ballIsSpawned) {
    //   spawnBall(world, playerEntity)
    //   ballIsSpawned = true
    //
    //   // process ball on next tick
    //   return
    // }

    if (!ballEntity) {
      return
    }

    const ballComponent = getComponent(ballEntity, DemoBallComponent)
    ballComponent.progress += deltaSeconds

    if (throwRequested) {
      throwRequested = false
      if (ballComponent.state === 'fired') {
        return
      }

      ballComponent.state = 'fired'
      ballComponent.progress = 0

      positionBallForThrow(playerEntity, ballEntity)
      const hoopTransform = getComponent(hoopEntity, TransformComponent)
      const ballTransform = getComponent(ballEntity, TransformComponent)

      addComponent(ballEntity, DemoBallShotComponent, {
        from: ballTransform.position.clone(),
        to: hoopTransform.position.clone(),
        progress: 0
      })
    }

    // if ball idle - bounce
    if (ballComponent.state === 'player-bouncing') {
      positionBallBesidePlayer(playerEntity, ballEntity)
      // const actorTransform = getComponent(playerEntity, TransformComponent)
      // const hoopTransform = getComponent(hoopEntity, TransformComponent)
      // const ballTransform = getComponent(ballEntity, TransformComponent)
      //
      // ballTransform.position.copy(hoopTransform.position)
    }

    // if shoot - move to target
    if (ballComponent.state === 'fired') {
      const ballTransform = getComponent(ballEntity, TransformComponent)
      const shotComponent = getComponent(ballEntity, DemoBallShotComponent)
      shotComponent.progress += deltaSeconds

      // calculate trajectory
      if (shotComponent.progress > 1) {
        removeComponent(ballEntity, DemoBallShotComponent)
        // return to player
        ballComponent.state = 'player-bouncing'
        return
      }

      ballTransform.position.lerpVectors(shotComponent.from, shotComponent.to, shotComponent.progress)
      ballTransform.position.y += Math.sin(shotComponent.progress * Math.PI)
    }
  }
}
