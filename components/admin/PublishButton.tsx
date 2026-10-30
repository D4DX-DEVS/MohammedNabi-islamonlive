'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useToast } from './ui'

type Run = { status: string; conclusion: string | null; createdAt: string; url: string } | null

// Edits are saved in the database at once but reach visitors only after the site is rebuilt (about two minutes).
// Publish starts that rebuild; the button then follows the job until it finishes.
export default function PublishButton() {
  const toast = useToast()
  const [running, setRunning] = useState(false)
  const timer = useRef<number>(0)
  const since = useRef(0) // when Publish was pressed; an older run is not ours
  const tries = useRef(0)

  const poll = useCallback(async (started: boolean) => {
    try {
      const { run } = await api<{ run: Run }>('publish')
      const active = run?.status === 'queued' || run?.status === 'in_progress' || run?.status === 'waiting'
      // GitHub can take a few seconds to list the new run; until it does, the latest one is the previous publish
      const ours = !started || (run && new Date(run.createdAt).getTime() >= since.current - 10_000)
      setRunning(active || (started && !ours && tries.current++ < 12))
      if (active || (started && !ours && tries.current < 12)) {
        timer.current = window.setTimeout(() => void poll(true), 8000)
      } else if (started && run && ours) {
        if (run.conclusion === 'success') toast.ok('Published. Changes are live.')
        else toast.err('Publishing failed. Open the Actions tab on GitHub for details.')
      }
    } catch {
      setRunning(false)
    }
  }, [toast])

  useEffect(() => {
    void poll(false) // pick up a publish that is already running
    return () => window.clearTimeout(timer.current)
  }, [poll])

  const start = async () => {
    setRunning(true)
    since.current = Date.now()
    tries.current = 0
    try {
      await api('publish', 'POST')
      timer.current = window.setTimeout(() => void poll(true), 5000)
    } catch (e) {
      setRunning(false)
      toast.err(e instanceof Error ? e.message : 'Could not start publishing')
    }
  }

  return (
    <button className="adm-btn adm-btn--block" disabled={running} onClick={() => void start()} title="Rebuild the site so saved changes go live">
      {running ? 'Publishing…' : 'Publish'}
    </button>
  )
}
