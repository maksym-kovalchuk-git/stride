import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

import { reconcileOrder, type ReconcileResult } from '@/features/checkout/api/reconcileOrder'
import type { ApplyResult } from '@/features/checkout/api/applyLiqpayResult'
import {
  RECONCILE_BATCH_LIMIT,
  RECONCILE_MAX_AGE_MINUTES,
  RECONCILE_MIN_AGE_MINUTES,
} from '@/features/checkout/config/payment'
import { LIQPAY_FAILED_STATUSES } from '@/features/checkout/lib/liqpayStatuses'
import { createAdminClient } from '@/shared/lib/supabase/admin'

// Звіряє з LiqPay замовлення, де спроба оплати була, а фінального статусу немає:
// гість закрив сторінку, callback не дійшов. pending → paid; cancelled з успішною оплатою → late_success.
// Два паралельні запуски безпечні: pending → paid умовний, повтор платежу впізнається за liqpay_payment_id
type Summary = {
  checked: number
  paid: number
  lateSuccess: number
  recorded: number
  ignored: number
  notFound: number
  unavailable: number
  skipped: number
  failed: number
}

// Record вимагає ключ для кожного варіанта: новий результат без лічильника не збереться
const APPLIED_COUNTERS: Record<ApplyResult, keyof Summary> = {
  paid: 'paid',
  late_success: 'lateSuccess',
  recorded: 'recorded',
  ignored: 'ignored',
}

const OTHER_COUNTERS: Record<Exclude<ReconcileResult['kind'], 'applied'>, keyof Summary> = {
  not_found: 'notFound',
  unavailable: 'unavailable',
  skipped: 'skipped',
}

function isAuthorized(request: Request, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(request.headers.get('authorization') ?? '')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export async function POST(request: Request) {
  // Fail closed: без секрету роут не працює взагалі
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('reconcile-payments: CRON_SECRET is not set')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  if (!isAuthorized(request, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const publicKey = process.env.LIQPAY_PUBLIC_KEY
  const privateKey = process.env.LIQPAY_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.error('reconcile-payments: LIQPAY_PUBLIC_KEY or LIQPAY_PRIVATE_KEY is not set')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const now = Date.now()
  const newestCreatedAt = new Date(now - RECONCILE_MIN_AGE_MINUTES * 60_000).toISOString()
  const oldestCreatedAt = new Date(now - RECONCILE_MAX_AGE_MINUTES * 60_000).toISOString()
  const finalStatuses = ['success', ...LIQPAY_FAILED_STATUSES].join(',')

  const supabase = createAdminClient()
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id')
    .eq('payment_method', 'card_online')
    .gt('payment_attempts', 0)
    .in('status', ['pending', 'cancelled'])
    .lt('created_at', newestCreatedAt)
    .gt('created_at', oldestCreatedAt)
    // NOT IN для NULL дає NULL, а не true — без is.null випали б замовлення, де callback не прийшов зовсім
    .or(`liqpay_status.is.null,liqpay_status.not.in.(${finalStatuses})`)
    // pending першими — його ще можна врятувати до скасування. Спирається на алфавіт:
    // 'pending' > 'cancelled'. Новий статус у .in() вище — перевір, куди він стане
    .order('status', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(RECONCILE_BATCH_LIMIT)

  if (error) {
    console.error('reconcile-payments: failed to select orders', error)
    return NextResponse.json({ error: 'Failed to select orders' }, { status: 500 })
  }

  const summary: Summary = {
    checked: 0, paid: 0, lateSuccess: 0, recorded: 0, ignored: 0,
    notFound: 0, unavailable: 0, skipped: 0, failed: 0,
  }

  // По черзі, а не Promise.all: не засипаємо LiqPay двадцятьма запитами одночасно
  for (const { id } of orders) {
    summary.checked++
    try {
      const reconciled = await reconcileOrder(id, publicKey, privateKey)
      summary[reconciled.kind === 'applied' ? APPLIED_COUNTERS[reconciled.result] : OTHER_COUNTERS[reconciled.kind]]++
    } catch (error) {
      summary.failed++
      console.error('reconcile-payments: failed to reconcile order', id, error)
    }
  }

  console.log('reconcile-payments:', JSON.stringify(summary))
  return NextResponse.json(summary)
}
