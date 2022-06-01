import { createState, useState } from '@hookstate/core'

import { NearbyUser } from '@xrengine/engine/src/networking/functions/getNearbyUsers'
import { MediaStreams } from '@xrengine/engine/src/networking/systems/MediaStreamSystem'

import { store } from '../../store'

//State
const state = createState({
  isCamVideoEnabled: false,
  isCamAudioEnabled: false,
  isFaceTrackingEnabled: false,
  enableBydefault: true,
  nearbyLayerUsers: [] as NearbyUser[],
  consumers: []
})

store.receptors.push((action: MediaStreamActionType): any => {
  state.batch((s) => {
    switch (action.type) {
      case 'CAM_VIDEO_CHANGED':
        return s.isCamVideoEnabled.set(action.isEnable)
      case 'CAM_AUDIO_CHANGED':
        return s.isCamAudioEnabled.set(action.isEnable)
      case 'FACE_TRACKING_CHANGED':
        return s.isFaceTrackingEnabled.set(action.isEnable)
      case 'MEDIA_ENABLE_BY_DEFAULT':
        return s.enableBydefault.set(action.isEnable)
      case 'CONSUMERS_CHANGED':
        return s.consumers.set(action.consumers)
      case 'NEARBY_LAYER_USERS_CHANGED':
        return s.nearbyLayerUsers.set(action.users)
    }
  }, action.type)
})

export const accessMediaStreamState = () => state
export const useMediaStreamState = () => useState(state)

let updateConsumerTimeout

//Service
export const MediaStreamService = {
  updateCamVideoState: () => {
    store.dispatch(
      MediaStreamAction.setCamVideoState(
        MediaStreams.instance.camVideoProducer != null && !MediaStreams.instance.videoPaused
      )
    )
  },
  triggerUpdateConsumers: () => {
    if (!updateConsumerTimeout) {
      updateConsumerTimeout = setTimeout(() => {
        store.dispatch(MediaStreamAction.setConsumers(MediaStreams.instance.consumers))
        updateConsumerTimeout = null
      }, 1000)
    }
  },
  triggerUpdateNearbyLayerUsers: () => {
    store.dispatch(MediaStreamAction.setNearbyLayerUsers(MediaStreams.instance.nearbyLayerUsers))
  },
  updateCamAudioState: () => {
    store.dispatch(
      MediaStreamAction.setCamAudioState(
        MediaStreams.instance.camAudioProducer != null && !MediaStreams.instance.audioPaused
      )
    )
  },
  updateFaceTrackingState: () => {
    store.dispatch(MediaStreamAction.setFaceTrackingState(MediaStreams.instance.faceTracking))
  },
  updateEnableMediaByDefault: () => {
    store.dispatch(MediaStreamAction.setMediaEnabledByDefault(false))
  }
}

//Action
export type BooleanAction = { [key: string]: boolean }
export const MediaStreamAction = {
  setCamVideoState: (isEnable: boolean) => {
    return { type: 'CAM_VIDEO_CHANGED' as const, isEnable: isEnable }
  },
  setCamAudioState: (isEnable: boolean) => {
    return { type: 'CAM_AUDIO_CHANGED' as const, isEnable }
  },
  setFaceTrackingState: (isEnable: boolean) => {
    return { type: 'FACE_TRACKING_CHANGED' as const, isEnable }
  },
  setMediaEnabledByDefault: (isEnable: boolean) => {
    return { type: 'MEDIA_ENABLE_BY_DEFAULT' as const, isEnable }
  },
  setConsumers: (consumers: any[]): any => {
    return { type: 'CONSUMERS_CHANGED' as const, consumers }
  },
  setNearbyLayerUsers: (users: NearbyUser[]): any => {
    return { type: 'NEARBY_LAYER_USERS_CHANGED' as const, users }
  }
}

export type MediaStreamActionType = ReturnType<typeof MediaStreamAction[keyof typeof MediaStreamAction]>
