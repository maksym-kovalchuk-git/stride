// Origin, з якого прийшов браузер, — для result_url. request.url у Next може бути нормалізований
// до localhost, тож беремо Host (за проксі чи тунелем — X-Forwarded-*): інакше LiqPay повертав
// користувача на localhost навіть з http://site.local:3000. Підробка Host змінить лише адресу
// повернення для самого автора запиту
export function getRequestOrigin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '')

  if (host) {
    try {
      return new URL(`${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`).origin
    } catch {
      // некоректний заголовок — падаємо на request.url
    }
  }
  return new URL(request.url).origin
}

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
