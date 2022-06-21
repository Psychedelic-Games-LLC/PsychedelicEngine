import { Vector3 } from 'three'

import { createMappedComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'

export type DemoBallComponentType = {
  state: 'player-bouncing' | 'bouncing' | 'fired'
  progress: number
}

export const DemoBallComponent = createMappedComponent<DemoBallComponentType>('DemoBallComponent')

export type DemoBallShotComponentType = {
  progress: number
  from: Vector3
  to: Vector3
}

export const DemoBallShotComponent = createMappedComponent<DemoBallShotComponentType>('DemoBallShotComponent')

export type TimedBounceComponentType = {
  timer?: number
  interval: number
}

export const TimedBounceComponent = createMappedComponent<TimedBounceComponentType>('TimedBounceComponent')

export type TimedRoamingComponentType = {
  timer?: number
  interval: number
}

export const TimedRoamingComponent = createMappedComponent<TimedRoamingComponentType>('TimedRoamingComponent')

export const NetworkedNpcComponentTag = createMappedComponent('NetworkedNpcComponentTag')
export const NetworkedBallComponentTag = createMappedComponent('NetworkedBallComponentTag')
