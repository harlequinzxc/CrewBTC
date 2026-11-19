import { useCallback, useState } from 'react'
import type { ToastMessage, ToastVariant } from './Toast'

export interface ToastInput {
  readonly variant: ToastVariant
  readonly title: string
  readonly description?: string | undefined
  readonly undo?: (() => void) | undefined
}

export interface ToastApi {
  readonly show: (input: ToastInput) => void
  readonly dismiss: (id: string) => void
  readonly messages: readonly ToastMessage[]
}

export interface ToastInput {
  readonly variant: ToastVariant
  readonly title: string
  readonly description?: string | undefined
  readonly undo?: (() => void) | undefined
}

export interface ToastApi {
  readonly show: (input: ToastInput) => void
  readonly dismiss: (id: string) => void
  readonly messages: readonly ToastMessage[]
}

/** Owns toast identity and lifetime; rendering stays in `<Toast />`. */
export function useToasts(): ToastApi {
  const [messages, setMessages] = useState<readonly ToastMessage[]>([])

  const dismiss = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id))
  }, [])

  const show = useCallback((input: ToastInput) => {
    const message: ToastMessage = { ...input, id: crypto.randomUUID() }
    setMessages((current) => [...current.slice(-2), message])
  }, [])

  return { show, dismiss, messages }
}

