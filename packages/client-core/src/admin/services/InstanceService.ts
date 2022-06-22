import { Paginated } from '@feathersjs/feathers'
import { useState } from '@speigg/hookstate'
import { useEffect } from 'react'

import { Instance } from '@xrengine/common/src/interfaces/Instance'
import { matches, Validator } from '@xrengine/engine/src/common/functions/MatchesUtils'
import {
  addActionReceptor,
  defineAction,
  defineState,
  dispatchAction,
  getState,
  registerState
} from '@xrengine/hyperflux'

import { API } from '../../API'
import { NotificationService } from '../../common/services/NotificationService'
import { accessAuthState } from '../../user/services/AuthService'

export const INSTANCE_PAGE_LIMIT = 100

export const AdminInstanceState = defineState({
  name: 'AdminInstanceState',
  initial: () => ({
    instances: [] as Array<Instance>,
    skip: 0,
    limit: INSTANCE_PAGE_LIMIT,
    total: 0,
    retrieving: false,
    fetched: false,
    updateNeeded: true,
    lastFetched: Date.now()
  })
})

export const AdminInstanceServiceReceptor = (action) => {
  getState(AdminInstanceState).batch((s) => {
    matches(action)
      .when(AdminInstanceActions.instancesRetrievedAction.matches, (action) => {
        return s.merge({
          instances: action.instanceResult.data,
          skip: action.instanceResult.skip,
          limit: action.instanceResult.limit,
          total: action.instanceResult.total,
          retrieving: false,
          fetched: true,
          updateNeeded: false,
          lastFetched: Date.now()
        })
      })
      .when(AdminInstanceActions.instancesRetrievedAction.matches, () => {
        return s.merge({ updateNeeded: true })
      })
  })
}

export const accessAdminInstanceState = () => getState(AdminInstanceState)

export const useAdminInstanceState = () => useState(accessAdminInstanceState())

//Service
export const AdminInstanceService = {
  fetchAdminInstances: async (value: string | null = null, skip = 0, sortField = 'createdAt', orderBy = 'asc') => {
    const user = accessAuthState().user
    try {
      if (user.userRole.value === 'admin') {
        let sortData = {}
        if (sortField.length > 0) {
          sortData[sortField] = orderBy === 'desc' ? 0 : 1
        }
        const instances = (await API.instance.client.service('instance').find({
          query: {
            $sort: {
              ...sortData
            },
            $skip: skip * INSTANCE_PAGE_LIMIT,
            $limit: INSTANCE_PAGE_LIMIT,
            action: 'admin',
            search: value
          }
        })) as Paginated<Instance>
        dispatchAction(AdminInstanceActions.instancesRetrievedAction({ instanceResult: instances }))
      }
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  removeInstance: async (id: string) => {
    const result = (await API.instance.client.service('instance').patch(id, { ended: true })) as Instance
    dispatchAction(AdminInstanceActions.instanceRemovedAction({ instance: result }))
  },
  useAPIListeners: () => {
    useEffect(() => {
      const listener = (params) => {
        dispatchAction(AdminInstanceActions.instanceRemovedAction({ instance: params.instance }))
      }
      API.instance.client.service('instance').on('removed', listener)
      return () => {
        API.instance.client.service('instance').off('removed', listener)
      }
    }, [])
  }
}

export class AdminInstanceActions {
  static instancesRetrievedAction = defineAction({
    type: 'admin.INSTANCES_RETRIEVED',
    instanceResult: matches.object as Validator<unknown, Paginated<Instance>>
  })

  static instanceRemovedAction = defineAction({
    type: 'admin.INSTANCE_REMOVED_ROW',
    instance: matches.object as Validator<unknown, Instance>
  })
}
