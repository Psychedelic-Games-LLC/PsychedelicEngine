import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, withRouter } from 'react-router-dom'

import Container from '@mui/material/Container'
import Button from '@mui/material/Button'

import { AuthService } from '../../services/AuthService'
import { useAuthState } from '../../services/AuthService'
import styles from "./styles.module.scss";

const DiscordCallbackComponent = (props): JSX.Element => {
  const { t } = useTranslation()
  const initialState = { error: '', token: '' }
  const [state, setState] = useState(initialState)
  const search = new URLSearchParams(useLocation().search)

  useEffect(() => {
    const error = search.get('error') as string
    const token = search.get('token') as string
    const type = search.get('type') as string
    const path = search.get('path') as string
    const instanceId = search.get('instanceId') as string

    if (!error) {
      if (type === 'connection') {
        const user = useAuthState().user
        AuthService.refreshConnections(user.id.value!)
      } else {
        let redirectSuccess = `${path}`
        if (instanceId != null) redirectSuccess += `?instanceId=${instanceId}`
        AuthService.loginUserByJwt(token, redirectSuccess || '/', '/')
      }
    }

    setState({ ...state, error, token })
  }, [])

  function redirectToRoot () {
    window.location.href = '/'
  }

  return state.error && state.error !== '' ? (
    <Container className={styles.oauthError}>
      <div className={styles.title}>{t('user:oauth.authFailed', { service: 'Discord' })}</div>
      <div className={styles.message}>{state.error}</div>
      <Button onClick={redirectToRoot} className={styles.submitButton}>
        {t('user:oauth.redirectToRoot')}
      </Button>
    </Container>
  ) : (
    <Container>{t('user:oauth.authenticating')}</Container>
  )
}

export const DiscordCallback = withRouter(DiscordCallbackComponent) as any
