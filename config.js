export function encodeData(data) {
    const str = JSON.stringify(data);
    const buf = Buffer.from(str, 'utf-8');
    return buf.toString('base64');
}

export function decodeData(str) {
    const buf = Buffer.from(str, 'base64');
    return JSON.parse(buf.toString('utf-8'));
}