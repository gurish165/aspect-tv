interface Window {
  aspectDesktop?: {
    remembersSettings: boolean
    isLocked: () => Promise<boolean>
    setLocked: (locked: boolean) => Promise<boolean>
  }
}
