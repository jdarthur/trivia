const get_session_remote = async function get_session(url: string, method: string, data?: unknown): Promise<any> {
    let body: string | undefined
    if (data !== undefined) {
        const copy = Object.assign({}, data)
        body = JSON.stringify(copy)
    }

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: body
    })
    return response.json()
}

function get_session_from_browser_storage(session_id: string) {

}

export default get_session_remote
