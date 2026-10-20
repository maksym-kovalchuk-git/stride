// APP_URL має бути чистим origin: без шляху, query й hash. Інакше server_url для LiqPay
// буде зламаним (так вийшло, коли в змінну потрапила адреса /_next/hmr?id=...)
export function getAppOrigin(value: string | undefined): string | null {
  if (!value) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  const isPlainOrigin = url.pathname === '/' && url.search === '' && url.hash === ''
  if (!isPlainOrigin) return null

  // LiqPay бачить лише публічний https; http дозволяємо тільки для localhost (тести без тунелю)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null

  return url.origin
}
