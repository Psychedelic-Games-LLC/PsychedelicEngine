import { Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereBufferGeometry, Vector3 } from 'three'

import { AvatarComponent } from '@xrengine/engine/src/avatar/components/AvatarComponent'
import { World } from '@xrengine/engine/src/ecs/classes/World'
import {
  addComponent,
  defineQuery,
  getComponent,
  removeComponent
} from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { createEntity } from '@xrengine/engine/src/ecs/functions/EntityFunctions'
import { VelocityComponent } from '@xrengine/engine/src/physics/components/VelocityComponent'
import { ModelComponent } from '@xrengine/engine/src/scene/components/ModelComponent'
import { NameComponent } from '@xrengine/engine/src/scene/components/NameComponent'
import { Object3DComponent } from '@xrengine/engine/src/scene/components/Object3DComponent'
import { TriggerVolumeComponent } from '@xrengine/engine/src/scene/components/TriggerVolumeComponent'
import { VisibleComponent } from '@xrengine/engine/src/scene/components/VisibleComponent'
import { TransformComponent } from '@xrengine/engine/src/transform/components/TransformComponent'
import { createActionQueue } from '@xrengine/hyperflux'

import { BasketballServerAction } from './BasketballServerAction'
import { bindKeyboardMap } from './bindKeyboard'
import { changeNpcAvatarReceptor, spawnBallReceptor, spawnNpcReceptor, switchAvatarReceptor } from './client-receptors'
import { DemoBallComponent, DemoBallShotComponent, NetworkedNpcComponent } from './components'
import { BALL_PLAYER_BOUNCE_DISTANCE, ballMesh } from './constants'
import { positionBallForThrow } from './function'

//import { AssetLoader } from '@xrengine/engine/src/assets/classes/AssetLoader'

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

function spawnBall(object: Object3D | null = null) {
  const ballObject = object?.clone() ?? ballMesh.clone()
  // spawn ball
  const ballEntity = createEntity()
  addComponent(ballEntity, DemoBallComponent, { state: 'player-bouncing', progress: 0 })
  addComponent(ballEntity, Object3DComponent, { value: ballObject })
  addComponent(ballEntity, TransformComponent, {
    position: new Vector3(),
    rotation: new Quaternion(),
    scale: new Vector3(1, 1, 1)
  })
  addComponent(ballEntity, VisibleComponent, {})

  return ballEntity
}

const triggerVolumesQuery = defineQuery([TriggerVolumeComponent, TransformComponent])
const playerQuery = defineQuery([AvatarComponent, TransformComponent])
const ballQuery = defineQuery([DemoBallComponent, Object3DComponent])
const firedBallQuery = defineQuery([DemoBallShotComponent, Object3DComponent])
const objectsQuery = defineQuery([Object3DComponent])
export const namedObjectsQuery = defineQuery([NameComponent, Object3DComponent])
const npcObjectsQuery = defineQuery([NetworkedNpcComponent, TransformComponent, VelocityComponent])

export default async function DemoSystemClient(world: World) {
  // await Promise.all([AssetLoader.loadAsync('/ball.fbx')])
  const spawnballQueue = createActionQueue(BasketballServerAction.spawnBallNetworkObject.matches)
  const spawnNpcQueue = createActionQueue(BasketballServerAction.spawnNpcNetworkObject.matches)
  const switchAvatarQueue = createActionQueue(BasketballServerAction.switchAvatarEntity.matches)
  const changeNpcAvatarQueue = createActionQueue(BasketballServerAction.changeNpcAvatar.matches)
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

  bindKeyboardMap()

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

    for (const action of switchAvatarQueue()) {
      switchAvatarReceptor(action)
    }

    for (const action of changeNpcAvatarQueue()) {
      changeNpcAvatarReceptor(action)
    }

    for (const spawnballQueueElement of spawnballQueue()) {
      const ballModelEntity = namedObjectsQuery().find((e) => {
        const { name } = getComponent(e, NameComponent)
        return name === 'BallModel'
      })
      if (!ballModelEntity) {
        console.error('failed to get ball model entity')
        return
      }
      spawnBallReceptor(spawnballQueueElement, ballModelEntity)
    }
    for (const action of spawnNpcQueue()) spawnNpcReceptor(action)

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
