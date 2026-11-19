/**
 * Opens the native file picker and resolves with the chosen files.
 * A plain hidden `<input type="file">` keeps this keyboard-accessible and avoids
 * pulling in the File System Access API where it is unavailable.
 */
export function pickFiles(accept = 'application/pdf,.pdf'): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = true
    input.style.display = 'none'

    let settled = false
    const settle = (files: File[]): void => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }

    input.addEventListener('change', () => {
      settle(Array.from(input.files ?? []))
    })

    // A cancelled picker fires no `change`; resolving on `cancel` keeps the queue
    // from being left in a permanent "busy" state.
    input.addEventListener('cancel', () => settle([]))

    document.body.appendChild(input)
    input.click()
  })
}
