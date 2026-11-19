import { Toast } from './Toast'
// ToastMessage is imported by use-toasts; not needed here.
import type { ToastApi } from './use-toasts'

export interface ToastHubProps {
  readonly api: ToastApi
}

export function ToastHub({ api }: ToastHubProps) {
  if (api.messages.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {api.messages.map((message) => (
        <Toast key={message.id} toast={message} onDismiss={api.dismiss} />
      ))}
    </div>
  )
}
