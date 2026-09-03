/**
 * Export the score graph as a PNG (ticket #240, part of #233).
 *
 * ScoreChart draws inline SVG styled by an external stylesheet. A serialized
 * SVG has no access to that stylesheet and no layout to inherit from, so this
 * module builds a standalone copy of it:
 *
 * 1. Clone the <svg> and copy each element's computed presentation onto it as
 *    presentation attributes (see COPY_PROPS).
 * 2. Append the legend as SVG primitives — color dot + name + total, per the
 *    ticket's guidance to keep icons out of the export — and grow the viewBox
 *    to make room for it.
 * 3. Fill an opaque background (the SVG has none of its own, and a transparent
 *    PNG is unreadable on a chat app's dark background).
 * 4. Rasterize through an <Image> onto a canvas at 2x for retina, and hand
 *    back a PNG blob.
 *
 * Nothing external is referenced — no <img>, no webfont, no remote href — so
 * the canvas stays untainted and toBlob() can't throw SecurityError. Callers
 * should still treat a rejection as "export is unavailable here" and degrade
 * rather than surface an error.
 *
 * Fonts: a data-URL SVG can only use locally installed fonts, never a webfont,
 * so text is pinned to a generic system stack rather than antd's family.
 */

// Presentation properties ScoreChart's CSS actually sets, mapped to their SVG
// initial values. Copying only what differs from the initial value keeps the
// serialized markup small (a 60-question, 12-team game is thousands of
// elements) without losing anything: an attribute equal to the initial value
// renders identically to an absent one.
const COPY_PROPS: Record<string, string> = {
    'fill': 'rgb(0, 0, 0)',
    'stroke': 'none',
    'stroke-width': '1',
    'stroke-linejoin': 'miter',
    'stroke-linecap': 'butt',
    'opacity': '1',
    'font-size': '16px',
    'font-weight': '400',
    'letter-spacing': 'normal',
    'text-transform': 'none',
    'display': 'inline',
    'visibility': 'visible',
}

// Generic stack only: a serialized SVG can't fetch a webfont, and naming a
// family that isn't installed silently changes text metrics.
const EXPORT_FONT = 'Helvetica, Arial, sans-serif'

const SVG_NS = 'http://www.w3.org/2000/svg'

const LEGEND_INK = 'rgba(0, 0, 0, 0.72)'
const LEGEND_RULE = '#f0f0f0'

export interface LegendEntry {
    name: string
    color: string
    /** Final cumulative total, already formatted for display. */
    total: string
    /** False for a team that left the game; the row is faded like the legend's. */
    active?: boolean
}

interface LegendLayout {
    /** Height of the legend block in viewBox units, including its top rule. */
    height: number
    /** The <g> to append to the exported SVG. */
    node: SVGGElement
}

function el<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs: Record<string, string | number>,
    text?: string,
): SVGElementTagNameMap[K] {
    const node = document.createElementNS(SVG_NS, tag)
    for (const key of Object.keys(attrs)) node.setAttribute(key, String(attrs[key]))
    if (text != null) node.textContent = text
    return node
}

/**
 * Copy the computed presentation of `source` onto `clone`, subtree in lockstep.
 * cloneNode(true) preserves structure exactly, so the two element lists stay
 * index-aligned without any selector work.
 */
function inlineStyles(source: Element, clone: Element) {
    const sourceEls = [source, ...Array.from(source.querySelectorAll('*'))]
    const cloneEls = [clone, ...Array.from(clone.querySelectorAll('*'))]
    const n = Math.min(sourceEls.length, cloneEls.length)
    for (let i = 0; i < n; i++) {
        const computed = window.getComputedStyle(sourceEls[i])
        for (const prop of Object.keys(COPY_PROPS)) {
            const value = computed.getPropertyValue(prop)
            // Skip empty values and ones already at the SVG initial value: an
            // attribute equal to the default renders identically to an absent
            // one, and skipping is what keeps the payload from exploding.
            if (!value || value === COPY_PROPS[prop]) continue
            clone.setAttribute(prop, value)
        }
        // Text is the only thing that can silently reflow, so pin its family.
        if (cloneEls[i].tagName.toLowerCase() === 'text') {
            clone.setAttribute('font-family', EXPORT_FONT)
        }
    }
}

// Rough advance width as a fraction of font size — the same estimate
// ScoreChart uses to thin its axis labels, so truncation agrees with what the
// on-screen legend would have shown.
const CHAR_W = 0.6

function clip(text: string, maxChars: number): string {
    if (maxChars < 4) return text.slice(0, Math.max(1, maxChars))
    return text.length <= maxChars ? text : text.slice(0, maxChars - 1).trimEnd() + '…'
}

/**
 * Build the export's legend: a grid of dot + name + total rows, matching the
 * on-screen legend's column behaviour (one column per ~200 viewBox units) so a
 * 12-team game doesn't export a 12-row wall.
 *
 * Coordinates are local to the block (y = 0 is its top edge); the caller places
 * it below the chart with a translate.
 */
function buildLegend(entries: LegendEntry[], width: number): LegendLayout {
    const font = Math.max(11, Math.min(15, Math.round(width * 0.021)))
    const rowH = Math.round(font * 1.9)
    const pad = Math.round(font * 0.8)
    const cols = Math.max(1, Math.floor(width / 200))
    const rows = Math.ceil(entries.length / cols) || 0
    const colW = width / cols
    // Room for the dot, the name, and a right-aligned total.
    const dotR = Math.max(4, Math.round(font * 0.36))
    const gap = Math.round(font * 0.5)
    const totalW = entries.reduce((w, e) => Math.max(w, e.total.length), 1) * font * CHAR_W + gap
    const nameChars = Math.floor((colW - dotR * 2 - gap * 3 - totalW) / (font * CHAR_W))

    const g = el('g', {'class': 'score-graph-export-legend'})
    g.appendChild(el('line', {
        x1: 0, x2: width, y1: pad, y2: pad,
        stroke: LEGEND_RULE, 'stroke-width': 1,
    }))
    entries.forEach((e, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x0 = col * colW
        const cy = pad + rowH * (row + 0.5)
        const rowNode = el('g', {opacity: e.active === false ? 0.5 : 1})
        rowNode.appendChild(el('circle', {
            cx: x0 + dotR + 2, cy, r: dotR, fill: e.color,
        }))
        rowNode.appendChild(el('text', {
            x: x0 + dotR * 2 + gap, y: cy,
            'dominant-baseline': 'middle', 'font-family': EXPORT_FONT,
            'font-size': font, fill: LEGEND_INK,
        }, clip(e.name, nameChars)))
        rowNode.appendChild(el('text', {
            x: x0 + colW - 2, y: cy,
            'text-anchor': 'end', 'dominant-baseline': 'middle',
            'font-family': EXPORT_FONT, 'font-size': font,
            'font-weight': 'bold', fill: LEGEND_INK,
        }, e.total))
        g.appendChild(rowNode)
    })

    return {height: pad * 2 + rows * rowH, node: g}
}

/**
 * Render the chart SVG (plus an optional legend) to a PNG blob at `scale`x its
 * viewBox size on an opaque `background`.
 *
 * Rejects if the browser can't serialize, decode, or rasterize it — callers
 * should degrade, not alert.
 */
export function chartToPngBlob(
    svg: SVGSVGElement,
    legend: LegendEntry[] = [],
    opts: {scale?: number, background?: string} = {},
): Promise<Blob> {
    try {
        return rasterize(svg, legend, opts)
    } catch (e) {
        // Clone/style-copy/serialize happens before any async work; a throw
        // there must still reach the caller's .catch, which is what disables
        // the button. A rejected promise is the only contract callers have.
        return Promise.reject(e instanceof Error ? e : new Error(String(e)))
    }
}

function rasterize(
    svg: SVGSVGElement,
    legend: LegendEntry[],
    opts: {scale?: number, background?: string},
): Promise<Blob> {
    const scale = opts.scale && opts.scale > 0 ? opts.scale : 2
    const background = opts.background ?? '#ffffff'

    const box = svg.viewBox && svg.viewBox.baseVal
    const width = box?.width || 0
    const height = box?.height || 0
    if (!(width > 0) || !(height > 0)) {
        return Promise.reject(new Error('Chart SVG has no viewBox size to rasterize'))
    }

    const clone = svg.cloneNode(true) as SVGSVGElement
    inlineStyles(svg, clone)
    clone.setAttribute('xmlns', SVG_NS)
    // Hit circles are interaction affordances with no visual; drop them so they
    // can't affect rendering (they're transparent, but they're pure noise).
    clone.querySelectorAll('.score-chart-hit').forEach(n => n.remove())

    const block = legend.length > 0 ? buildLegend(legend, width) : null
    const totalH = height + (block ? block.height : 0)

    // Standalone SVG has no CSS `width: 100%` to resolve against, so pin the
    // pixel size the canvas will be drawn at.
    clone.setAttribute('width', String(Math.round(width * scale)))
    clone.setAttribute('height', String(Math.round(totalH * scale)))
    clone.setAttribute('viewBox', `0 0 ${width} ${totalH}`)
    // Opaque backdrop first, under the chart's own geometry.
    clone.insertBefore(el('rect', {x: 0, y: 0, width, height: totalH, fill: background}), clone.firstChild)
    // The legend block is drawn in its own local coordinates, so it has to be
    // pushed down below the chart's plot area.
    if (block) {
        block.node.setAttribute('transform', `translate(0 ${height})`)
        clone.appendChild(block.node)
    }

    const markup = new XMLSerializer().serializeToString(clone)
    // Encoded, not base64: the markup is full of '#' (hex colors), which a raw
    // data URL would read as a fragment, and btoa chokes on non-Latin1 text.
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)

    return new Promise<Blob>((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = Math.round(width * scale)
                canvas.height = Math.round(totalH * scale)
                const ctx = canvas.getContext('2d')
                if (!ctx) throw new Error('Canvas 2D context unavailable')
                // Redundant with the rect above, but guarantees opacity even if
                // an older browser skips the injected node.
                ctx.fillStyle = background
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
                canvas.toBlob(blob => {
                    if (blob) resolve(blob)
                    else reject(new Error('Canvas produced no PNG'))
                }, 'image/png')
            } catch (e) {
                // A tainted canvas throws right here.
                reject(e instanceof Error ? e : new Error(String(e)))
            }
        }
        image.onerror = () => reject(new Error('Could not decode the exported chart SVG'))
        image.src = url
    })
}

/** Trigger a browser download of `blob` as `filename`, leaving no stray node. */
export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoke on a later tick so the download has taken the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * A filesystem-safe export name: lowercase, anything else collapsed to '-',
 * trimmed and capped. Falls back to the session id, then to a constant, so it
 * is never just "trivia-.png".
 */
export function exportFilename(name?: string | null, fallback?: string | null): string {
    const slug = (name ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '')
    const tail = slug || (fallback ?? '').replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'score-graph'
    return `trivia-${tail}.png`
}
