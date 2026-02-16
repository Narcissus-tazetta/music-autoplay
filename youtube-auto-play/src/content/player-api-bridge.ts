/**
 * Runs in MAIN world so we can access YouTube's internal #movie_player API.
 * When player state becomes "ended" (0), dispatches ytAutoplayPlayerEnded so the
 * ISOLATED content script can run the same debounced end-handler.
 */
(function() {
    const YT_END_STATE = 0;
    const RETRY_MS = 500;
    const RETRY_MAX = 20;

    function tryAttach(): void {
        const el = document.getElementById('movie_player') as
            | (HTMLElement & { addEventListener?(event: string, cb: (state: number) => void): void })
            | null;
        if (!el || typeof el.addEventListener !== 'function') return;

        el.addEventListener('onStateChange', (stateOrEvent: number | { data?: number }) => {
            const state = typeof stateOrEvent === 'number' ? stateOrEvent : stateOrEvent?.data;
            if (state === YT_END_STATE) window.dispatchEvent(new CustomEvent('ytAutoplayPlayerEnded', { detail: {} }));
        });
    }

    let attempts = 0;
    const id = window.setInterval(() => {
        tryAttach();
        attempts++;
        if (attempts >= RETRY_MAX) window.clearInterval(id);
    }, RETRY_MS);
})();
