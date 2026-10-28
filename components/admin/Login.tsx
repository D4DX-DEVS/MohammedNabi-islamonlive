'use client'

import { useState } from 'react'
import { api } from './api'
import { Icon } from './ui'

export default function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="adm-login">
      <form
        className="adm-login__card"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            await api('login', 'POST', { password })
            onDone()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed')
            setBusy(false)
          }
        }}
      >
        <img className="adm-login__logo" src="/uploads/2018/10/logo-nabi1.png" alt="Mohammed Nabi" />
        <h1>Admin</h1>
        <p className="adm-help">Sign in to manage posts.</p>
        <label className="adm-field">
          Password
          <span className="adm-pass">
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required aria-invalid={Boolean(error)} />
            <button type="button" className="adm-icon" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              <Icon name={show ? 'eyeOff' : 'eye'} />
            </button>
          </span>
        </label>
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="adm-btn adm-btn--block" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}
