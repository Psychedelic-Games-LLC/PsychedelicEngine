import { Application } from '../../../declarations'
import { IdentityProvider } from './identity-provider.class'
import identyDocs from './identity-provider.docs'
import hooks from './identity-provider.hooks'
import createModel from './identity-provider.model'
import {getStorageProvider} from "../../media/storageprovider/storageprovider";
import authenticate from "../../hooks/authenticate";
import restrictUserRole from "../../hooks/restrict-user-role";

declare module '@xrengine/common/declarations' {
  interface ServiceTypes {
    'identity-provider': IdentityProvider
  }
}

/**
 * Initialize our service with any options it requires and docs
 *
 * @author Vyacheslav Solovjov
 */
export default (app: Application): void => {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: true
  }

  const event = new IdentityProvider(options, app)
  event.docs = identyDocs

  app.use('identity-provider', event)

  const service = app.service('identity-provider')

  app.use('generate-token', {
    create: async ({ type, token }, params): string | null => {
      const userId = params.user.id
      if (!token || !type) throw new Error('Must pass service and identity-provider token to generate JWT')
      const ipResult = await app.service('identity-provider').find({
        query: {
          userId: userId,
          type: type,
          token: token
        }
      })
      console.log('ipResult', ipResult)
      if (ipResult.total > 0) {
        const ip = ipResult.data[0]
        const newToken = await app.service('authentication').createAccessToken({}, { subject: ip.id.toString()})
        console.log('newToken', newToken)
        return newToken
      } else return null
    }
  })

  app.service('generate-token').hooks({
    before: {
      create: [authenticate()]
    }
  })

  service.hooks(hooks)
}
