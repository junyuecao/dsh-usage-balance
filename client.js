/**
 * Client half of the usage & balance bundle.
 *
 * Registers one ambient readout in the session header: the DeepSeek account
 * balance (recharge and bonus wallets) beside this session's provider-reported
 * token usage. Balance comes from the account Remotes; usage comes from the
 * `tokenUsage` session projection, so nothing is recomputed from the log here.
 *
 * The readout owns its own error boundary: a render failure must not leave an
 * empty hole in the header with the cause visible only in the console.
 */
window.__ModuleLoader__.load({
  id: '@local/usage-balance',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const { createElement: h, useEffect, useId, useRef, useState } = React

    const NS = 'usage-balance'

    /** Simplified Chinese dictionary (the key-set source of truth). */
    const zh = {
      'panel.title': '用量与余额',
      'balance': '余额',
      'balance.loading': '余额…',
      'balance.signedOut': '未登录',
      'balance.failed': '读取失败',
      'balance.unavailable': '余额不可用',
      'bonus': '赠送余额',
      'usage': '本会话用量',
      'usage.prompt': '输入（未缓存）',
      'usage.cacheRead': '缓存读取',
      'usage.cacheWrite': '缓存写入',
      'usage.inputTotal': '输入合计',
      'usage.output': '输出',
      'usage.total': '合计',
      'usage.empty': '本会话尚无用量。',
      'panel.signedOutHint': '在左下角「设置 → 账户」登录 DeepSeek 账户后，这里会显示余额。',
      'panel.failedHint': '余额读取失败，可以点「刷新」重试，或在「设置 → 账户」查看。',
      'panel.unavailableHint': '当前配置没有提供 DeepSeek 账户服务，无法读取余额。',
      'panel.loading': '正在读取余额…',
      'panel.refreshing': '刷新中…',
      'panel.refresh': '刷新',
      'panel.usage': '查看平台用量',
      'panel.updated': '更新于 {time}',
      'aria.balance': '余额 {value}',
      'aria.usage': '本会话输入 {input} tokens，输出 {output} tokens',
      'entry.error': '用量显示失败',
    }

    /** English dictionary, key-identical to the Chinese source of truth. */
    const en = {
      'panel.title': 'Usage and balance',
      'balance': 'Balance',
      'balance.loading': 'Balance…',
      'balance.signedOut': 'Signed out',
      'balance.failed': 'Read failed',
      'balance.unavailable': 'Unavailable',
      'bonus': 'Bonus balance',
      'usage': "This session's usage",
      'usage.prompt': 'Input (uncached)',
      'usage.cacheRead': 'Cache read',
      'usage.cacheWrite': 'Cache write',
      'usage.inputTotal': 'Input total',
      'usage.output': 'Output',
      'usage.total': 'Total',
      'usage.empty': 'No usage in this session yet.',
      'panel.signedOutHint': 'Sign in to a DeepSeek account from Settings → Account to see your balance here.',
      'panel.failedHint': 'The balance read failed. Try Refresh, or check Settings → Account.',
      'panel.unavailableHint': 'This configuration provides no DeepSeek account service, so no balance can be read.',
      'panel.loading': 'Reading balance…',
      'panel.refreshing': 'Refreshing…',
      'panel.refresh': 'Refresh',
      'panel.usage': 'Platform usage',
      'panel.updated': 'Updated {time}',
      'aria.balance': 'Balance {value}',
      'aria.usage': 'This session: {input} input tokens, {output} output tokens',
      'entry.error': 'Usage readout failed',
    }

    const CSS = `
.ub-root { position: relative; display: inline-flex; flex: none; align-items: center; margin-left: 4px; min-width: 0; }
.ub-trigger { display: inline-flex; align-items: center; gap: 7px; height: 28px; max-width: 100%; padding: 0 9px;
  border: 0; border-radius: 999px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit;
  font-size: 12px; line-height: 16px; white-space: nowrap; cursor: pointer; }
.ub-trigger:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px; }
.ub-trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover); }
@media (hover: hover) { .ub-trigger:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); } }
.ub-amount { overflow: hidden; text-overflow: ellipsis; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }
.ub-tokens { overflow: hidden; text-overflow: ellipsis; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.ub-muted { color: var(--dsw-alias-label-tertiary); }
.ub-error { color: var(--dsw-alias-state-error-primary); }
.ub-broken { color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 16px; white-space: nowrap; }
.ub-sep { width: 1px; height: 10px; background: var(--dsw-alias-border-l2); }
.ub-panel { position: fixed; z-index: 100; box-sizing: border-box; width: 300px; max-width: calc(100vw - 24px);
  padding: 12px 14px; border-radius: 16px; background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter); box-shadow: var(--dsw-elevation-prominent);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 18px; }
.ub-panel:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.ub-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.ub-section { margin: 12px 0 4px; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.ub-rows { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 0; }
.ub-rows dt { color: var(--dsw-alias-label-secondary); }
.ub-rows dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.ub-hint { margin: 0; color: var(--dsw-alias-label-tertiary); }
.ub-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px;
  padding-top: 10px; border-top: 1px solid var(--dsw-alias-border-l1); }
.ub-actions { display: inline-flex; align-items: center; gap: 4px; }
.ub-button, .ub-link { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border: 0;
  border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; cursor: pointer; }
.ub-link { text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--dsw-alias-border-l2); }
.ub-button:disabled { color: var(--dsw-alias-label-tertiary); cursor: default; }
.ub-button:focus-visible, .ub-link:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px; }
@media (hover: hover) {
  .ub-button:not(:disabled):hover { background: var(--dsw-alias-interactive-bg-hover); }
  .ub-link:hover { background: var(--dsw-alias-interactive-bg-hover); text-decoration-color: currentColor; }
}
@media (max-width: 720px) { .ub-tokens, .ub-sep { display: none; } }
@container (max-width: 560px) { .ub-tokens, .ub-sep { display: none; } }
`

    /** Compact token count through the host's shared K/M vocabulary. */
    function formatTokens(value, t) {
      if (!Number.isFinite(value) || value <= 0) return '0'
      const scaled = (candidate) => candidate >= 100
        ? String(Math.round(candidate))
        : String(Math.round(candidate * 10) / 10)
      if (value < 1000) return String(Math.round(value))
      if (value < 1000000) return t('number.thousand', { value: scaled(value / 1000) })
      return t('number.million', { value: scaled(value / 1000000) })
    }

    /** Full token count with grouping for the detail rows. */
    function fullNumber(value) {
      return Number.isFinite(value) ? Math.round(value).toLocaleString() : '—'
    }

    /** Wallet amount with the two-decimal, sub-cent display rule. */
    function formatAmount(amount, currency) {
      const symbol = currency === 'CNY' ? '¥' : '$'
      const value = Number(amount)
      if (!Number.isFinite(value)) return symbol + amount
      const magnitude = Math.abs(value)
      if (magnitude > 0 && magnitude < 0.01) return '<' + symbol + '0.01'
      const text = magnitude.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return (value < 0 ? '-' : '') + symbol + text
    }

    /** The wallet figures of one settled balance read. */
    function walletText(wallets) {
      if (!Array.isArray(wallets) || wallets.length === 0) return ''
      return wallets.map((wallet) => formatAmount(wallet.balance, wallet.currency)).join(' / ')
    }

    /**
     * Balance state shared by every header occurrence: one read at a time, a
     * timer only while something renders it, and a fresh read after the page
     * regains focus.
     */
    function createBalanceStore(ctx) {
      let snapshot = { status: 'idle', wallets: [], bonusWallets: [], links: null, at: 0, refreshing: false }
      const listeners = new Set()
      let inflight = null
      let timer = null

      const publish = (next) => {
        snapshot = next
        for (const listener of [...listeners]) listener()
      }

      const clientMetadata = () => {
        const locale = ctx.locale.getSnapshot().active
        let accountUi
        try {
          // Optional seam: only the shipped account feature provides it.
          accountUi = ctx.get('accountUi')
        } catch (_error) {
          accountUi = undefined
        }
        if (accountUi && typeof accountUi.clientMetadata === 'function') {
          try {
            return accountUi.clientMetadata(locale)
          } catch (error) {
            console.error('[usage-balance] account client metadata unavailable', error)
          }
        }
        const boot = globalThis.__DSH_BOOT__
        const release = boot && typeof boot === 'object' ? boot.release : undefined
        const version = release && typeof release.version === 'string' && release.version !== '' ? release.version : '1.0.0'
        return { version, locale, timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 }
      }

      const load = () => {
        if (inflight !== null) return inflight
        const remote = ctx.get('remote')
        const account = remote && remote.account
        if (!account || typeof account.getState !== 'function' || typeof account.getBalance !== 'function') {
          if (snapshot.status === 'idle') publish({ ...snapshot, status: 'unavailable', refreshing: false })
          return Promise.resolve()
        }
        publish({ ...snapshot, refreshing: true })
        inflight = (async () => {
          try {
            const state = await account.getState()
            if (!state.ok) throw state.error || new Error('account state read failed')
            const view = state.value
            const links = view && view.links ? view.links : null
            if (!view || view.status !== 'credential-stored') {
              publish({ status: 'signed-out', wallets: [], bonusWallets: [], links, at: Date.now(), refreshing: false })
              return
            }
            const result = await account.getBalance(clientMetadata())
            if (!result.ok) throw result.error || new Error('balance read failed')
            const balance = result.value
            if (balance === null) {
              publish({ status: 'signed-out', wallets: [], bonusWallets: [], links, at: Date.now(), refreshing: false })
              return
            }
            if (balance.status !== 'ready') throw new Error('balance unavailable')
            publish({
              status: 'ready',
              wallets: Array.isArray(balance.value) ? balance.value : [],
              bonusWallets: Array.isArray(balance.bonusWallets) ? balance.bonusWallets : [],
              links,
              at: Date.now(),
              refreshing: false,
            })
          } catch (error) {
            console.error('[usage-balance] balance read failed', error)
            // A failed refresh keeps the last good wallet figures on screen; only
            // a first read with nothing to show turns into the failure state.
            const hasValue = snapshot.status === 'ready' && snapshot.wallets.length > 0
            publish({ ...snapshot, status: hasValue ? 'ready' : 'failed', at: hasValue ? snapshot.at : Date.now(), refreshing: false })
          } finally {
            inflight = null
          }
        })()
        return inflight
      }

      const subscribe = (listener) => {
        listeners.add(listener)
        if (listeners.size === 1) {
          void load()
          timer = setInterval(() => { void load() }, 5 * 60 * 1000)
        }
        return () => {
          listeners.delete(listener)
          if (listeners.size === 0 && timer !== null) {
            clearInterval(timer)
            timer = null
          }
        }
      }

      ctx.effect(() => () => {
        if (timer !== null) {
          clearInterval(timer)
          timer = null
        }
      }, 'usage-balance: balance timer')

      ctx.effect(() => {
        const onVisibility = () => {
          if (document.visibilityState !== 'visible' || listeners.size === 0) return
          if (Date.now() - snapshot.at < 60 * 1000) return
          void load()
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => { document.removeEventListener('visibilitychange', onVisibility) }
      }, 'usage-balance: refresh after focus')

      // The account feature announces credential and snapshot changes; ride them
      // so a sign-in or sign-out is reflected without waiting for the timer, but
      // keep a floor so its own refresh burst cannot turn into a request loop.
      ctx.effect(() => ctx.on('account-ui/change', () => {
        if (listeners.size === 0) return
        if (Date.now() - snapshot.at < 5000) return
        void load()
      }), 'usage-balance: account state change')

      return { getSnapshot: () => snapshot, subscribe, load }
    }

    /** One `dt`/`dd` pair; returns a flat array so React keys stay explicit. */
    function row(key, label, value) {
      return [
        h('dt', { key: key + '-t' }, label),
        h('dd', { key: key + '-d' }, value),
      ]
    }

    /** Detail popover: balance wallets, this session's token buckets, and actions. */
    function DetailPanel(props) {
      const { t, snapshot, usage, onRefresh, onClose, panelRef, panelId, formatTime, position } = props
      const { status, wallets, bonusWallets, links, at, refreshing } = snapshot
      const bonus = status === 'ready' ? bonusWallets.filter((wallet) => Number(wallet.balance) > 0) : []
      const amountText = status === 'ready' ? walletText(wallets) : ''
      const bonusText = walletText(bonus)
      const inputTotal = usage
        ? (usage.uncachedInputTokens || 0) + (usage.cacheReadTokens || 0) + (usage.cacheWriteTokens || 0)
        : 0
      const total = usage ? inputTotal + (usage.outputTokens || 0) : 0
      const walletRows = amountText !== '' ? row('balance', t('balance'), amountText) : []
      const bonusRows = bonusText !== '' ? row('bonus', t('bonus'), bonusText) : []
      const usageRows = usage
        ? [
          ...row('prompt', t('usage.prompt'), fullNumber(usage.uncachedInputTokens)),
          ...row('cacheRead', t('usage.cacheRead'), fullNumber(usage.cacheReadTokens)),
          ...row('cacheWrite', t('usage.cacheWrite'), fullNumber(usage.cacheWriteTokens)),
          ...row('inputTotal', t('usage.inputTotal'), fullNumber(inputTotal)),
          ...row('output', t('usage.output'), fullNumber(usage.outputTokens)),
          ...row('total', t('usage.total'), fullNumber(total)),
        ]
        : []
      const balanceNotice = status === 'signed-out'
        ? h('p', { className: 'ub-hint' }, t('panel.signedOutHint'))
        : status === 'failed'
          ? h('p', { className: 'ub-error', role: 'status' }, t('panel.failedHint'))
          : status === 'unavailable'
            ? h('p', { className: 'ub-hint' }, t('panel.unavailableHint'))
            : status === 'idle' || status === 'loading'
              ? h('p', { className: 'ub-hint', role: 'status' }, t('panel.loading'))
              : null

      return h('div', {
        id: panelId,
        ref: panelRef,
        className: 'ub-panel',
        style: { top: position.top + 'px', right: position.right + 'px' },
        role: 'dialog',
        tabIndex: -1,
        'aria-label': t('panel.title'),
        onKeyDown: (event) => { if (event.key === 'Escape') onClose() },
      },
      h('div', { className: 'ub-title' }, t('panel.title')),
      balanceNotice,
      walletRows.length > 0 ? h('dl', { className: 'ub-rows' }, walletRows, bonusRows) : null,
      h('div', { className: 'ub-section' }, t('usage')),
      usageRows.length > 0
        ? h('dl', { className: 'ub-rows' }, usageRows)
        : h('p', { className: 'ub-hint' }, t('usage.empty')),
      h('div', { className: 'ub-footer' },
        h('span', { className: 'ub-muted' }, at > 0 ? t('panel.updated', { time: formatTime(at) }) : ''),
        h('span', { className: 'ub-actions' },
          h('button', {
            type: 'button',
            className: 'ub-button',
            disabled: refreshing,
            onClick: onRefresh,
          }, refreshing ? t('panel.refreshing') : t('panel.refresh')),
          links && links.usageUrl
            ? h('a', {
              className: 'ub-link',
              href: links.usageUrl,
              target: '_blank',
              rel: 'noreferrer',
            }, t('panel.usage'))
            : null,
        ),
      ))
    }

    /** Build the header entry over one balance store; the store survives remounts. */
    function makeEntry(store) {
      /** Subscribe the component to the balance store without an injected hook face. */
      function useBalanceSnapshot() {
        const [value, setValue] = useState(() => store.getSnapshot())
        useEffect(() => {
          let live = true
          const sync = () => { if (live) setValue(store.getSnapshot()) }
          sync()
          const unsubscribe = store.subscribe(sync)
          return () => { live = false; unsubscribe() }
        }, [])
        return value
      }

      /** Session-header entry: the compact readout and its popover. */
      return function UsageBalanceEntry(props) {
        const { t, refresh, formatTime } = props
        const snapshot = useBalanceSnapshot()
        const usage = props.useProjection('tokenUsage')
        const [open, setOpen] = useState(false)
        const [position, setPosition] = useState(null)
        const rootRef = useRef(null)
        const triggerRef = useRef(null)
        const panelRef = useRef(null)
        const instanceId = useId()
        const panelId = 'usage-balance-panel' + instanceId.replace(/[^a-zA-Z0-9_-]/g, '')

        const tokens = usage === undefined || usage === null
          ? null
          : {
            input: (usage.uncachedInputTokens || 0) + (usage.cacheReadTokens || 0) + (usage.cacheWriteTokens || 0),
            output: usage.outputTokens || 0,
          }
        const hasUsage = tokens !== null && (tokens.input > 0 || tokens.output > 0)
        const status = snapshot.status
        const wallets = snapshot.wallets

        const place = () => {
          const node = triggerRef.current
          if (!node) return
          const rect = node.getBoundingClientRect()
          const height = panelRef.current ? panelRef.current.offsetHeight : 0
          const below = rect.bottom + 6
          const flip = height > 0 && below + height > window.innerHeight - 12
          setPosition({
            top: flip ? Math.max(12, rect.top - height - 6) : below,
            right: Math.max(12, window.innerWidth - rect.right),
          })
        }

        const close = () => {
          setOpen(false)
          if (triggerRef.current) triggerRef.current.focus()
        }

        const toggle = () => {
          if (open) {
            setOpen(false)
            return
          }
          place()
          setOpen(true)
        }

        useEffect(() => {
          if (!open) return undefined
          place()
          if (panelRef.current) panelRef.current.focus()
          const onPointerDown = (event) => {
            const target = event.target
            if (panelRef.current && panelRef.current.contains(target)) return
            if (rootRef.current && rootRef.current.contains(target)) return
            setOpen(false)
          }
          const onKeyDown = (event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            close()
          }
          window.addEventListener('resize', place)
          window.addEventListener('scroll', place, true)
          document.addEventListener('pointerdown', onPointerDown, true)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', place, true)
            document.removeEventListener('pointerdown', onPointerDown, true)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [open])

        const amountText = status === 'ready' ? walletText(wallets) : ''
        let balanceNode = null
        let balanceLabel = ''
        if (status === 'ready' && amountText !== '') {
          balanceNode = h('span', { className: 'ub-amount' }, amountText)
          balanceLabel = amountText
        } else if (status === 'signed-out') {
          balanceNode = h('span', { className: 'ub-muted' }, t('balance.signedOut'))
          balanceLabel = t('balance.signedOut')
        } else if (status === 'failed') {
          balanceNode = h('span', { className: 'ub-error' }, t('balance.failed'))
          balanceLabel = t('balance.failed')
        } else if (status === 'unavailable') {
          balanceNode = h('span', { className: 'ub-muted' }, t('balance.unavailable'))
          balanceLabel = t('balance.unavailable')
        } else {
          balanceNode = h('span', { className: 'ub-muted' }, t('balance.loading'))
          balanceLabel = t('balance.loading')
        }

        const ariaParts = [t('panel.title'), t('aria.balance', { value: balanceLabel })]
        if (hasUsage) ariaParts.push(t('aria.usage', { input: formatTokens(tokens.input, t), output: formatTokens(tokens.output, t) }))

        return h('div', { ref: rootRef, className: 'ub-root' },
          h('button', {
            ref: triggerRef,
            type: 'button',
            className: 'ub-trigger',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-controls': open ? panelId : undefined,
            'aria-label': ariaParts.join(' · '),
            title: ariaParts.join(' · '),
            onClick: toggle,
          },
          balanceNode,
          hasUsage ? h('span', { className: 'ub-sep', 'aria-hidden': true }) : null,
          hasUsage
            ? h('span', { className: 'ub-tokens' },
              h('span', { key: 'in' }, '↑' + formatTokens(tokens.input, t)),
              ' ',
              h('span', { key: 'out' }, '↓' + formatTokens(tokens.output, t)))
            : null,
          ),
          open && position !== null
            ? ReactDOM.createPortal(h(DetailPanel, {
              t,
              snapshot,
              usage: usage === undefined ? null : usage,
              onRefresh: () => { refresh() },
              onClose: close,
              panelRef,
              panelId,
              formatTime,
              position,
            }), document.body, 'panel')
            : null,
        )
      }
    }

    /** Keep one readout failure out of the slot outlet and visible in the header. */
    class EntryBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error) {
        console.error('[usage-balance] readout render failed', error)
      }

      render() {
        if (this.state.error) {
          const detail = this.state.error && this.state.error.message
            ? String(this.state.error.message)
            : String(this.state.error)
          return h('span', { className: 'ub-broken', role: 'status', title: detail }, this.props.t('entry.error'))
        }
        return this.props.children
      }
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.account'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'usage-balance: dictionaries')
        const store = createBalanceStore(ctx)
        const Entry = makeEntry(store)
        // The surface owns its stylesheet and its failure boundary, so a broken
        // readout still draws something in place of a silent empty cell.
        function UsageBalance(props) {
          return h(React.Fragment, null,
            h('style', { key: 'style' }, CSS),
            h(EntryBoundary, { t: props.t }, h(Entry, props)))
        }
        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'usage-balance',
          // Left of the reminder catalog (-5) and the header overflow menu (0).
          order: -6,
          locale: NS,
          inject: () => ({
            refresh: () => { void store.load() },
            // Reads the live interface language, so the stamp follows a locale switch.
            formatTime: (ms) => new Date(ms).toLocaleTimeString(ctx.locale.getSnapshot().active),
          }),
        }, UsageBalance))
      },
    }
  },
})
