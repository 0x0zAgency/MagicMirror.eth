import { OpenAIApi, Configuration } from 'openai'
import server from '../../server.mjs'
import { success, userError } from '../../utils/helpers.mjs'

// Configure OpenAI
const configuration = new Configuration(
  server.config.openapi && server.config.openapi.apiKey
    ? server.config.openapi
    : { apiKey: process.env.OPENAI_KEY }
)

const openai = new OpenAIApi(configuration)

const redisClient = server.redisClient

/**
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
export const post = async (request, response) => {
  let temperature = parseFloat(request.body.temp) || 0.6
  if (isNaN(temperature)) temperature = 0.6

  if (temperature > 3) {
    temperature = 3
  }

  if (request.body.prompt === undefined) {
    return userError(response, 'No prompt provided')
  }

  let n = parseInt(request.body.n) || 2

  if (isNaN(n)) {
    n = 2
  }

  if (n > 6) {
    n = 6
  }

  const cacheEntry = async () => {
    if (request.body.ensAddress === null) {
      return userError(request.body, 'No ensAddress was specified!')
    }

    if (redisClient.hExists(request.body.ensAddress)) {
      // If it already exists, return the existing entry rather than wasting time
      // replacing it with new values.
      return await redisClient.hGet(request.body.ensAddress)
    }

    await redisClient.hSet(request.body.ensAddress, response.body.choices[0])
  }

  if (request.body.ensAddress.split('.').pop() !== 'eth') { return userError('response', 'not an ens address') }

  try {
    const prompt =
      `Using HTML, create a site with an idea for ${request.body.ensAddress}.
      Return only valid HTML. Do not explain your thought process.`

    const completion = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      temperature,
      n,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })

    const html = completion.data.choices[Math.floor(Math.random() * completion.data.choices.length)].text

    success(response, {
      html,
      prompt,
      generated: Date.now()
    })

    await redisClient.disconnect()
  } catch (error) {
    console.log('OpenAI Error', error)
    await redisClient.disconnect()
    return userError(response, 'Sorry, OpenAI is not responding right now. Please try again later.')
  }
}

/**
 * Uncomment to specify path
 */
// export const path = '/<folder/dirs>/<this_file_name>'