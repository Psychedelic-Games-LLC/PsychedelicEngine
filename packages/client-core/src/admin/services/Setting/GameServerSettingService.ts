import { Paginated } from '@feathersjs/feathers'
import { createState, useState } from '@hookstate/core'

import { GameServerSetting } from '@xrengine/common/src/interfaces/GameServerSetting'

import { NotificationService } from '../../../common/services/NotificationService'
import { client } from '../../../feathers'
import { store, useDispatch } from '../../../store'

//State
const state = createState({
  gameserver: [] as Array<GameServerSetting>,
  updateNeeded: true
})

store.receptors.push((action: GameServerSettingActionType): any => {
  state.batch((s) => {
    switch (action.type) {
      case 'GAME_SERVER_SETTING_DISPLAY':
        return s.merge({ gameserver: action.gameServerSettingResult.data, updateNeeded: false })
    }
  }, action.type)
})

export const accessGameServerSettingState = () => state

export const useGameServerSettingState = () => useState(state) as any as typeof state

//Service
export const GameServerSettingService = {
  fetchedGameServerSettings: async (inDec?: 'increment' | 'decrement') => {
    const dispatch = useDispatch()
    try {
      const gameServer = (await client.service('game-server-setting').find()) as Paginated<GameServerSetting>
      dispatch(GameServerSettingAction.fetchedGameServer(gameServer))
    } catch (err) {
      console.log(err.message)
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  }
}

//Action
export const GameServerSettingAction = {
  fetchedGameServer: (gameServerSettingResult: Paginated<GameServerSetting>) => {
    return {
      type: 'GAME_SERVER_SETTING_DISPLAY',
      gameServerSettingResult: gameServerSettingResult
    }
  }
}
export type GameServerSettingActionType = ReturnType<
  typeof GameServerSettingAction[keyof typeof GameServerSettingAction]
>
