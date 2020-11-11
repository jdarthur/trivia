const get_session_remote = async function get_session(url, method, data) {
    let body
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

function get_session_from_browser_storage(session_id) {

}

export default get_session