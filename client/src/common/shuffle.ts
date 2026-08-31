// Deterministic seeded shuffle helpers shared by the mod's in-game question
// box (ticket #215) and the editor's question preview — both need a stable
// permutation (same input → same output) without an RNG dependency.

// FNV-1a 32-bit over the given parts — a stable, dependency-free seed.
export function hashSeed(...parts: (string | number)[]): number {
    let hash = 0x811c9dc5
    for (const part of parts) {
        const text = String(part)
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i)
            hash = Math.imul(hash, 0x01000193)
        }
    }
    return hash >>> 0
}

// mulberry32: a tiny seeded PRNG backing the deterministic shuffle.
function mulberry32(seed: number): () => number {
    let state = seed
    return () => {
        state = (state + 0x6D2B79F5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Fisher-Yates with the seeded PRNG. Returns a new array; the input is not
// mutated.
export function seededShuffle(items: string[], seed: number): string[] {
    const out = [...items]
    const rand = mulberry32(seed)
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}
