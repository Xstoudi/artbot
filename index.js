import axios from 'axios'
import FormData from 'form-data'
import { createWriteStream, createReadStream } from 'node:fs'
import { decodeData } from './config.js'

async function routine({ wikiartBaseUrl, wikiartAccessKey, wikiartSecretKey, artistIdentifier, mastoUrl, mastoAccessToken, constHashtags }) {
    const wikiArtAuth = await axios(`${wikiartBaseUrl}/Api/2/login`, { params: {
        accessCode: wikiartAccessKey,
        secretCode: wikiartSecretKey
    }}).then(res => res.data)

    const { SessionKey: wikiartSession } = wikiArtAuth

    const offset = Math.ceil((new Date().getTime() - new Date('12/19/2022').getTime()) / (1000 * 60 * 60 * 24))

    const painting = await getDailyPainting(offset)
    await downloadAndSave(painting.image)
    await toot(painting)

    async function getDailyPainting(offset) {
        let currentMaxCursor = 0
        let paginationCursor = undefined
        let hasMore = true
        while(hasMore) {
            const wikiArtPaintings = await axios(`${wikiartBaseUrl}/api/2/PaintingsByArtist`, { 
                params: { 
                    id: artistIdentifier,
                    paginationCursor,
                    authSessionKey: wikiartSession,
                }
            }).then(res => res.data)
            const { data, paginationToken, hasMore: hasMoreThisTime } = wikiArtPaintings
            hasMore = hasMoreThisTime
            paginationCursor = paginationToken

            if(offset < currentMaxCursor + data.length) {
                // return full painting
                const painting = await axios(`${wikiartBaseUrl}/api/2/Painting`, {
                    params: {
                        id: data[offset - currentMaxCursor].id,
                    }
                }).then(res => res.data)
                return painting
            }

            currentMaxCursor += data.length
        }
        console.log('No more paintings found should reset')
    }

    async function downloadAndSave(url) {
        const writer = createWriteStream(`./painting-${artistIdentifier}.jpg`)
        const response = await axios(url, { responseType: 'stream' })
        response.data.pipe(writer)
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
        })
    }

    async function toot(painting) {
        const mediaFormData = new FormData()
        mediaFormData.append('file', createReadStream(`./painting-${artistIdentifier}.jpg`))
        mediaFormData.append('description', 'Sorry I made this bot in two hours during courses, proper description is yet to come.')
        const media = await axios.post(
            `${mastoUrl}/api/v1/media`,
            mediaFormData,
            {
                headers: {
                    ...mediaFormData.getHeaders(),
                    Authorization: `Bearer ${mastoAccessToken}`
                }
            }
        ).then(res => res.data)
        
        const hashtags = [...painting.genres, ...painting.styles, ...constHashtags]
            .map(x => x.toLowerCase())
            .map(x => x.replaceAll(' ', '_'))
            .map(x => x.replaceAll('-', '_'))
            .map(x => `#${x}`)
        await axios.post(
            `${mastoUrl}/api/v1/statuses`,
            {
                status: `${wikiartBaseUrl}/${painting.artistUrl}/${painting.url} \n ${hashtags.join(' ')} `,
                spoiler_text: `${painting.title}, ${painting.completitionYear} by ${painting.artistName}`,
                visibility: 'public',
                sensitive: true,
                media_ids: [media.id],
                language: 'en'
            },
            {
                headers: {
                    Authorization: `Bearer ${mastoAccessToken}`
                }
            }
        ).then(res => res.data).catch(err => console.log(err))
    }
}


for(const config of decodeData(process.env.CONFIG)) {
    await routine(config)
}